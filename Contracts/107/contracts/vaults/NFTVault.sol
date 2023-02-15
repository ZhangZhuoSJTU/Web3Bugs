// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "../interfaces/IAggregatorV3Interface.sol";
import "../interfaces/IStableCoin.sol";
import "../interfaces/IJPEGLock.sol";

/// @title NFT lending vault
/// @notice This contracts allows users to borrow PUSD using NFTs as collateral.
/// The floor price of the NFT collection is fetched using a chainlink oracle, while some other more valuable traits
/// can have an higher price set by the DAO. Users can also increase the price (and thus the borrow limit) of their
/// NFT by submitting a governance proposal. If the proposal is approved the user can lock a percentage of the new price
/// worth of JPEG to make it effective
contract NFTVault is AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    event PositionOpened(address indexed owner, uint256 indexed index);
    event Borrowed(
        address indexed owner,
        uint256 indexed index,
        uint256 amount
    );
    event Repaid(address indexed owner, uint256 indexed index, uint256 amount);
    event PositionClosed(address indexed owner, uint256 indexed index);
    event Liquidated(
        address indexed liquidator,
        address indexed owner,
        uint256 indexed index,
        bool insured
    );
    event Repurchased(address indexed owner, uint256 indexed index);
    event InsuranceExpired(address indexed owner, uint256 indexed index);

    enum BorrowType {
        NOT_CONFIRMED,
        NON_INSURANCE,
        USE_INSURANCE
    }

    struct Position {
        BorrowType borrowType;
        uint256 debtPrincipal;
        uint256 debtPortion;
        uint256 debtAmountForRepurchase;
        uint256 liquidatedAt;
        address liquidator;
    }

    struct Rate {
        uint128 numerator;
        uint128 denominator;
    }

    struct VaultSettings {
        Rate debtInterestApr;
        Rate creditLimitRate;
        Rate liquidationLimitRate;
        Rate valueIncreaseLockRate;
        Rate organizationFeeRate;
        Rate insurancePurchaseRate;
        Rate insuranceLiquidationPenaltyRate;
        uint256 insuraceRepurchaseTimeLimit;
        uint256 borrowAmountCap;
    }

    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");

    bytes32 public constant CUSTOM_NFT_HASH = keccak256("CUSTOM");

    IStableCoin public stablecoin;
    /// @notice Chainlink ETH/USD price feed
    IAggregatorV3Interface public ethAggregator;
    /// @notice Chainlink JPEG/USD price feed
    IAggregatorV3Interface public jpegAggregator;
    /// @notice Chainlink NFT floor oracle
    IAggregatorV3Interface public floorOracle;
    /// @notice Chainlink NFT fallback floor oracle
    IAggregatorV3Interface public fallbackOracle;
    /// @notice JPEGLocker, used by this contract to lock JPEG and increase the value of an NFT
    IJPEGLock public jpegLocker;
    IERC721Upgradeable public nftContract;

    /// @notice If true, the floor price won't be fetched using the Chainlink oracle but
    /// a value set by the DAO will be used instead
    bool public daoFloorOverride;
    // @notice If true, the floor price will be fetched using the fallback oracle
    bool public useFallbackOracle;
    /// @notice Total outstanding debt
    uint256 public totalDebtAmount;
    /// @dev Last time debt was accrued. See {accrue} for more info
    uint256 public totalDebtAccruedAt;
    uint256 public totalFeeCollected;
    uint256 internal totalDebtPortion;

    VaultSettings public settings;

    /// @dev Keeps track of all the NFTs used as collateral for positions
    EnumerableSetUpgradeable.UintSet private positionIndexes;

    mapping(uint256 => Position) private positions;
    mapping(uint256 => address) public positionOwner;
    mapping(bytes32 => uint256) public nftTypeValueETH;
    mapping(uint256 => uint256) public nftValueETH;
    //bytes32(0) is floor
    mapping(uint256 => bytes32) public nftTypes;
    mapping(uint256 => uint256) public pendingNFTValueETH;

    /// @dev Checks if the provided NFT index is valid
    /// @param nftIndex The index to check
    modifier validNFTIndex(uint256 nftIndex) {
        //The standard OZ ERC721 implementation of ownerOf reverts on a non existing nft isntead of returning address(0)
        require(nftContract.ownerOf(nftIndex) != address(0), "invalid_nft");
        _;
    }

    struct NFTCategoryInitializer {
        bytes32 hash;
        uint256 valueETH;
        uint256[] nfts;
    }

    /// @param _stablecoin PUSD address
    /// @param _nftContract The NFT contrat address. It could also be the address of an helper contract
    /// if the target NFT isn't an ERC721 (CryptoPunks as an example)
    /// @param _ethAggregator Chainlink ETH/USD price feed address
    /// @param _jpegAggregator Chainlink JPEG/USD price feed address
    /// @param _floorOracle Chainlink floor oracle address
    /// @param _fallbackOracle Chainlink fallback floor oracle address
    /// @param _typeInitializers Used to initialize NFT categories with their value and NFT indexes.
    /// Floor NFT shouldn't be initialized this way
    /// @param _jpegLocker JPEGLock address
    /// @param _settings Initial settings used by the contract
    function initialize(
        IStableCoin _stablecoin,
        IERC721Upgradeable _nftContract,
        IAggregatorV3Interface _ethAggregator,
        IAggregatorV3Interface _jpegAggregator,
        IAggregatorV3Interface _floorOracle,
        IAggregatorV3Interface _fallbackOracle,
        NFTCategoryInitializer[] memory _typeInitializers,
        IJPEGLock _jpegLocker,
        VaultSettings memory _settings
    ) external initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _setupRole(DAO_ROLE, msg.sender);
        _setRoleAdmin(LIQUIDATOR_ROLE, DAO_ROLE);
        _setRoleAdmin(DAO_ROLE, DAO_ROLE);

        _validateRate(_settings.debtInterestApr);
        _validateRate(_settings.creditLimitRate);
        _validateRate(_settings.liquidationLimitRate);
        _validateRate(_settings.valueIncreaseLockRate);
        _validateRate(_settings.organizationFeeRate);
        _validateRate(_settings.insurancePurchaseRate);
        _validateRate(_settings.insuranceLiquidationPenaltyRate);

        _validateCreditLimitAndLiquidationRate(
            _settings.creditLimitRate,
            _settings.liquidationLimitRate
        );

        stablecoin = _stablecoin;
        jpegLocker = _jpegLocker;
        ethAggregator = _ethAggregator;
        jpegAggregator = _jpegAggregator;
        floorOracle = _floorOracle;
        fallbackOracle = _fallbackOracle;
        nftContract = _nftContract;

        settings = _settings;

        //initializing the categories
        for (uint256 i = 0; i < _typeInitializers.length; i++) {
            NFTCategoryInitializer memory initializer = _typeInitializers[i];
            nftTypeValueETH[initializer.hash] = initializer.valueETH;
            for (uint256 j = 0; j < initializer.nfts.length; j++) {
                nftTypes[initializer.nfts[j]] = initializer.hash;
            }
        }
    }

    /// @dev The {accrue} function updates the contract's state by calculating
    /// the additional interest accrued since the last state update
    function accrue() public {
        uint256 additionalInterest = _calculateAdditionalInterest();

        totalDebtAccruedAt = block.timestamp;

        totalDebtAmount += additionalInterest;
        totalFeeCollected += additionalInterest;
    }

    /// @notice Allows the DAO to change the total debt cap
    /// @param _borrowAmountCap New total debt cap
    function setBorrowAmountCap(uint256 _borrowAmountCap)
        external
        onlyRole(DAO_ROLE)
    {
        settings.borrowAmountCap = _borrowAmountCap;
    }

    /// @notice Allows the DAO to change the interest APR on borrows
    /// @param _debtInterestApr The new interest rate
    function setDebtInterestApr(Rate memory _debtInterestApr)
        external
        onlyRole(DAO_ROLE)
    {
        _validateRate(_debtInterestApr);
        settings.debtInterestApr = _debtInterestApr;
    }

    /// @notice Allows the DAO to change the amount of JPEG needed to increase the value of an NFT relative to the desired value
    /// @param _valueIncreaseLockRate The new rate
    function setValueIncreaseLockRate(Rate memory _valueIncreaseLockRate)
        external
        onlyRole(DAO_ROLE)
    {
        _validateRate(_valueIncreaseLockRate);
        settings.valueIncreaseLockRate = _valueIncreaseLockRate;
    }

    /// @notice Allows the DAO to change the max debt to collateral rate for a position
    /// @param _creditLimitRate The new rate
    function setCreditLimitRate(Rate memory _creditLimitRate)
        external
        onlyRole(DAO_ROLE)
    {
        _validateRate(_creditLimitRate);
        _validateCreditLimitAndLiquidationRate(
            _creditLimitRate,
            settings.liquidationLimitRate
        );

        settings.creditLimitRate = _creditLimitRate;
    }

    /// @notice Allows the DAO to change the minimum debt to collateral rate for a position to be market as liquidatable
    /// @param _liquidationLimitRate The new rate
    function setLiquidationLimitRate(Rate memory _liquidationLimitRate)
        external
        onlyRole(DAO_ROLE)
    {
        _validateRate(_liquidationLimitRate);
        _validateCreditLimitAndLiquidationRate(
            settings.creditLimitRate,
            _liquidationLimitRate
        );

        settings.liquidationLimitRate = _liquidationLimitRate;
    }

    /// @notice Allows the DAO to toggle the fallback oracle
    /// @param _useFallback Whether to use the fallback oracle
    function toggleFallbackOracle(bool _useFallback)
        external
        onlyRole(DAO_ROLE)
    {
        useFallbackOracle = _useFallback;
    }

    /// @notice Allows the DAO to change the amount of time JPEG tokens need to be locked to change the value of an NFT
    /// @param _newLockTime The amount new lock time amount
    function setJPEGLockTime(uint256 _newLockTime) external onlyRole(DAO_ROLE) {
        jpegLocker.setLockTime(_newLockTime);
    }

    /// @notice Allows the DAO to bypass the floor oracle and override the NFT floor value
    /// @param _newFloor The new floor
    function overrideFloor(uint256 _newFloor) external onlyRole(DAO_ROLE) {
        require(_newFloor > 0, "Invalid floor");
        nftTypeValueETH[bytes32(0)] = _newFloor;
        daoFloorOverride = true;
    }

    /// @notice Allows the DAO to stop overriding floor
    function disableFloorOverride() external onlyRole(DAO_ROLE) {
        daoFloorOverride = false;
    }

    /// @notice Allows the DAO to change the static borrow fee
    /// @param _organizationFeeRate The new fee rate
    function setOrganizationFeeRate(Rate memory _organizationFeeRate)
        external
        onlyRole(DAO_ROLE)
    {
        _validateRate(_organizationFeeRate);
        settings.organizationFeeRate = _organizationFeeRate;
    }

    /// @notice Allows the DAO to change the cost of insurance
    /// @param _insurancePurchaseRate The new insurance fee rate
    function setInsurancePurchaseRate(Rate memory _insurancePurchaseRate)
        external
        onlyRole(DAO_ROLE)
    {
        _validateRate(_insurancePurchaseRate);
        settings.insurancePurchaseRate = _insurancePurchaseRate;
    }

    /// @notice Allows the DAO to change the repurchase penalty rate in case of liquidation of an insured NFT
    /// @param _insuranceLiquidationPenaltyRate The new rate
    function setInsuranceLiquidationPenaltyRate(
        Rate memory _insuranceLiquidationPenaltyRate
    ) external onlyRole(DAO_ROLE) {
        _validateRate(_insuranceLiquidationPenaltyRate);
        settings
            .insuranceLiquidationPenaltyRate = _insuranceLiquidationPenaltyRate;
    }

    /// @notice Allows the DAO to add an NFT to a specific price category
    /// @param _nftIndex The index to add to the category
    /// @param _type The category hash
    function setNFTType(uint256 _nftIndex, bytes32 _type)
        external
        validNFTIndex(_nftIndex)
        onlyRole(DAO_ROLE)
    {
        require(
            _type == bytes32(0) || nftTypeValueETH[_type] > 0,
            "invalid_nftType"
        );
        nftTypes[_nftIndex] = _type;
    }

    /// @notice Allows the DAO to change the value of an NFT category
    /// @param _type The category hash
    /// @param _amountETH The new value, in ETH
    function setNFTTypeValueETH(bytes32 _type, uint256 _amountETH)
        external
        onlyRole(DAO_ROLE)
    {
        nftTypeValueETH[_type] = _amountETH;
    }

    /// @notice Allows the DAO to set the value in ETH of the NFT at index `_nftIndex`.
    /// A JPEG deposit by a user is required afterwards. See {finalizePendingNFTValueETH} for more details
    /// @param _nftIndex The index of the NFT to change the value of
    /// @param _amountETH The new desired ETH value
    function setPendingNFTValueETH(uint256 _nftIndex, uint256 _amountETH)
        external
        validNFTIndex(_nftIndex)
        onlyRole(DAO_ROLE)
    {
        pendingNFTValueETH[_nftIndex] = _amountETH;
    }

    /// @notice Allows a user to lock up JPEG to make the change in value of an NFT effective.
    /// Can only be called after {setPendingNFTValueETH}, which requires a governance vote.
    /// @dev The amount of JPEG that needs to be locked is calculated by applying `valueIncreaseLockRate`
    /// to the new credit limit of the NFT
    /// @param _nftIndex The index of the NFT
    function finalizePendingNFTValueETH(uint256 _nftIndex)
        external
        validNFTIndex(_nftIndex)
    {
        uint256 pendingValue = pendingNFTValueETH[_nftIndex];
        require(pendingValue > 0, "no_pending_value");
        uint256 toLockJpeg = (((pendingValue *
            _ethPriceUSD() *
            settings.creditLimitRate.numerator) /
            settings.creditLimitRate.denominator) *
            settings.valueIncreaseLockRate.numerator) /
            settings.valueIncreaseLockRate.denominator /
            _jpegPriceUSD();

        //lock JPEG using JPEGLock
        jpegLocker.lockFor(msg.sender, _nftIndex, toLockJpeg);

        nftTypes[_nftIndex] = CUSTOM_NFT_HASH;
        nftValueETH[_nftIndex] = pendingValue;
        //clear pending value
        pendingNFTValueETH[_nftIndex] = 0;
    }

    /// @dev Validates the credit limit rate and the liquidation limit rate.
    /// The credit limit rate must be less than the liquidation rate
    /// @param _creditLimitRate The credit limit rate to validate
    /// @param _liquidationLimitRate The liquidation limit rate
    function _validateCreditLimitAndLiquidationRate(
        Rate memory _creditLimitRate,
        Rate memory _liquidationLimitRate
    ) internal pure {
        require(
            _liquidationLimitRate.numerator * _creditLimitRate.denominator >
                _creditLimitRate.numerator * _liquidationLimitRate.denominator,
            "credit_rate_exceeds_or_equals_liquidation_rate"
        );
    }

    /// @dev Validates a rate. The denominator must be greater than zero and greater than or equal to the numerator.
    /// @param rate The rate to validate
    function _validateRate(Rate memory rate) internal pure {
        require(
            rate.denominator > 0 && rate.denominator >= rate.numerator,
            "invalid_rate"
        );
    }

    /// @dev Returns the value in ETH of the NFT at index `_nftIndex`
    /// @param _nftIndex The NFT to return the value of
    /// @return The value of the NFT, 18 decimals
    function _getNFTValueETH(uint256 _nftIndex)
        internal
        view
        returns (uint256)
    {
        bytes32 nftType = nftTypes[_nftIndex];

        if (nftType == bytes32(0) && !daoFloorOverride) {
            return
                _normalizeAggregatorAnswer(
                    useFallbackOracle ? fallbackOracle : floorOracle
                );
        } else if (nftType == CUSTOM_NFT_HASH) return nftValueETH[_nftIndex];

        return nftTypeValueETH[nftType];
    }

    /// @dev Returns the value in USD of the NFT at index `_nftIndex`
    /// @param _nftIndex The NFT to return the value of
    /// @return The value of the NFT in USD, 18 decimals
    function _getNFTValueUSD(uint256 _nftIndex)
        internal
        view
        returns (uint256)
    {
        uint256 nft_value = _getNFTValueETH(_nftIndex);
        return (nft_value * _ethPriceUSD()) / 1 ether;
    }

    /// @dev Returns the current ETH price in USD
    /// @return The current ETH price, 18 decimals
    function _ethPriceUSD() internal view returns (uint256) {
        return _normalizeAggregatorAnswer(ethAggregator);
    }

    /// @dev Returns the current JPEG price in USD
    /// @return The current JPEG price, 18 decimals
    function _jpegPriceUSD() internal view returns (uint256) {
        return _normalizeAggregatorAnswer(jpegAggregator);
    }

    /// @dev Fetches and converts to 18 decimals precision the latest answer of a Chainlink aggregator
    /// @param aggregator The aggregator to fetch the answer from
    /// @return The latest aggregator answer, normalized
    function _normalizeAggregatorAnswer(IAggregatorV3Interface aggregator)
        internal
        view
        returns (uint256)
    {
        int256 answer = aggregator.latestAnswer();
        uint8 decimals = aggregator.decimals();

        require(answer > 0, "invalid_oracle_answer");
        //converts the answer to have 18 decimals
        return
            decimals > 18
                ? uint256(answer) / 10**(decimals - 18)
                : uint256(answer) * 10**(18 - decimals);
    }

    struct NFTInfo {
        uint256 index;
        bytes32 nftType;
        address owner;
        uint256 nftValueETH;
        uint256 nftValueUSD;
    }

    /// @notice Returns data relative to the NFT at index `_nftIndex`
    /// @param _nftIndex The NFT index
    /// @return nftInfo The data relative to the NFT
    function getNFTInfo(uint256 _nftIndex)
        external
        view
        returns (NFTInfo memory nftInfo)
    {
        nftInfo = NFTInfo(
            _nftIndex,
            nftTypes[_nftIndex],
            nftContract.ownerOf(_nftIndex),
            _getNFTValueETH(_nftIndex),
            _getNFTValueUSD(_nftIndex)
        );
    }

    /// @dev Returns the credit limit of an NFT
    /// @param _nftIndex The NFT to return credit limit of
    /// @return The NFT credit limit
    function _getCreditLimit(uint256 _nftIndex)
        internal
        view
        returns (uint256)
    {
        uint256 asset_value = _getNFTValueUSD(_nftIndex);
        return
            (asset_value * settings.creditLimitRate.numerator) /
            settings.creditLimitRate.denominator;
    }

    /// @dev Returns the minimum amount of debt necessary to liquidate an NFT
    /// @param _nftIndex The index of the NFT
    /// @return The minimum amount of debt to liquidate the NFT
    function _getLiquidationLimit(uint256 _nftIndex)
        internal
        view
        returns (uint256)
    {
        uint256 asset_value = _getNFTValueUSD(_nftIndex);
        return
            (asset_value * settings.liquidationLimitRate.numerator) /
            settings.liquidationLimitRate.denominator;
    }

    /// @dev Calculates current outstanding debt of an NFT
    /// @param _nftIndex The NFT to calculate the outstanding debt of
    /// @return The outstanding debt value
    function _getDebtAmount(uint256 _nftIndex) internal view returns (uint256) {
        uint256 calculatedDebt = _calculateDebt(
            totalDebtAmount,
            positions[_nftIndex].debtPortion,
            totalDebtPortion
        );

        uint256 principal = positions[_nftIndex].debtPrincipal;

        //_calculateDebt is prone to rounding errors that may cause
        //the calculated debt amount to be 1 or 2 units less than
        //the debt principal when the accrue() function isn't called
        //in between the first borrow and the _calculateDebt call.
        return principal > calculatedDebt ? principal : calculatedDebt;
    }

    /// @dev Calculates the total debt of a position given the global debt, the user's portion of the debt and the total user portions
    /// @param total The global outstanding debt
    /// @param userPortion The user's portion of debt
    /// @param totalPortion The total user portions of debt
    /// @return The outstanding debt of the position
    function _calculateDebt(
        uint256 total,
        uint256 userPortion,
        uint256 totalPortion
    ) internal pure returns (uint256) {
        return totalPortion == 0 ? 0 : (total * userPortion) / totalPortion;
    }

    /// @dev Opens a position
    /// Emits a {PositionOpened} event
    /// @param _owner The owner of the position to open
    /// @param _nftIndex The NFT used as collateral for the position
    function _openPosition(address _owner, uint256 _nftIndex) internal {
        nftContract.transferFrom(_owner, address(this), _nftIndex);

        positions[_nftIndex] = Position({
            borrowType: BorrowType.NOT_CONFIRMED,
            debtPrincipal: 0,
            debtPortion: 0,
            debtAmountForRepurchase: 0,
            liquidatedAt: 0,
            liquidator: address(0)
        });
        positionOwner[_nftIndex] = _owner;
        positionIndexes.add(_nftIndex);

        emit PositionOpened(_owner, _nftIndex);
    }

    /// @dev Calculates the additional global interest since last time the contract's state was updated by calling {accrue}
    /// @return The additional interest value
    function _calculateAdditionalInterest() internal view returns (uint256) {
        // Number of seconds since {accrue} was called
        uint256 elapsedTime = block.timestamp - totalDebtAccruedAt;
        if (elapsedTime == 0) {
            return 0;
        }

        if (totalDebtAmount == 0) {
            return 0;
        }

        // Accrue interest
        uint256 interestPerYear = (totalDebtAmount *
            settings.debtInterestApr.numerator) /
            settings.debtInterestApr.denominator;
        uint256 interestPerSec = interestPerYear / 365 days;

        return elapsedTime * interestPerSec;
    }

    /// @notice Returns the number of open positions
    /// @return The number of open positions
    function totalPositions() external view returns (uint256) {
        return positionIndexes.length();
    }

    /// @notice Returns all open position NFT indexes
    /// @return The open position NFT indexes
    function openPositionsIndexes() external view returns (uint256[] memory) {
        return positionIndexes.values();
    }

    struct PositionPreview {
        address owner;
        uint256 nftIndex;
        bytes32 nftType;
        uint256 nftValueUSD;
        VaultSettings vaultSettings;
        uint256 creditLimit;
        uint256 debtPrincipal;
        uint256 debtInterest;
        BorrowType borrowType;
        bool liquidatable;
        uint256 liquidatedAt;
        address liquidator;
    }

    /// @notice Returns data relative to a postition, existing or not
    /// @param _nftIndex The index of the NFT used as collateral for the position
    /// @return preview See assignment below
    function showPosition(uint256 _nftIndex)
        external
        view
        validNFTIndex(_nftIndex)
        returns (PositionPreview memory preview)
    {
        address posOwner = positionOwner[_nftIndex];

        uint256 debtPrincipal = positions[_nftIndex].debtPrincipal;
        uint256 debtAmount = positions[_nftIndex].liquidatedAt > 0
            ? positions[_nftIndex].debtAmountForRepurchase //calculate updated debt
            : _calculateDebt(
                totalDebtAmount + _calculateAdditionalInterest(),
                positions[_nftIndex].debtPortion,
                totalDebtPortion
            );

        //_calculateDebt is prone to rounding errors that may cause
        //the calculated debt amount to be 1 or 2 units less than
        //the debt principal if no time has elapsed in between the first borrow
        //and the _calculateDebt call.
        if (debtPrincipal > debtAmount) debtAmount = debtPrincipal;

        preview = PositionPreview({
            owner: posOwner, //the owner of the position, `address(0)` if the position doesn't exists
            nftIndex: _nftIndex, //the NFT used as collateral for the position
            nftType: nftTypes[_nftIndex], //the type of the NFT
            nftValueUSD: _getNFTValueUSD(_nftIndex), //the value in USD of the NFT
            vaultSettings: settings, //the current vault's settings
            creditLimit: _getCreditLimit(_nftIndex), //the NFT's credit limit
            debtPrincipal: debtPrincipal, //the debt principal for the position, `0` if the position doesn't exists
            debtInterest: debtAmount - debtPrincipal, //the interest of the position
            borrowType: positions[_nftIndex].borrowType, //the insurance type of the position, `NOT_CONFIRMED` if it doesn't exist
            liquidatable: positions[_nftIndex].liquidatedAt == 0 &&
                debtAmount >= _getLiquidationLimit(_nftIndex), //if the position can be liquidated
            liquidatedAt: positions[_nftIndex].liquidatedAt, //if the position has been liquidated and it had insurance, the timestamp at which the liquidation happened
            liquidator: positions[_nftIndex].liquidator //if the position has been liquidated and it had insurance, the address of the liquidator
        });
    }

    /// @notice Allows users to open positions and borrow using an NFT
    /// @dev emits a {Borrowed} event
    /// @param _nftIndex The index of the NFT to be used as collateral
    /// @param _amount The amount of PUSD to be borrowed. Note that the user will receive less than the amount requested,
    /// the borrow fee and insurance automatically get removed from the amount borrowed
    /// @param _useInsurance Whereter to open an insured position. In case the position has already been opened previously,
    /// this parameter needs to match the previous insurance mode. To change insurance mode, a user needs to close and reopen the position
    function borrow(
        uint256 _nftIndex,
        uint256 _amount,
        bool _useInsurance
    ) external validNFTIndex(_nftIndex) nonReentrant {
        accrue();

        require(
            msg.sender == positionOwner[_nftIndex] ||
                address(0) == positionOwner[_nftIndex],
            "unauthorized"
        );
        require(_amount > 0, "invalid_amount");
        require(
            totalDebtAmount + _amount <= settings.borrowAmountCap,
            "debt_cap"
        );

        if (positionOwner[_nftIndex] == address(0)) {
            _openPosition(msg.sender, _nftIndex);
        }

        Position storage position = positions[_nftIndex];
        require(position.liquidatedAt == 0, "liquidated");
        require(
            position.borrowType == BorrowType.NOT_CONFIRMED ||
                (position.borrowType == BorrowType.USE_INSURANCE &&
                    _useInsurance) ||
                (position.borrowType == BorrowType.NON_INSURANCE &&
                    !_useInsurance),
            "invalid_insurance_mode"
        );

        uint256 creditLimit = _getCreditLimit(_nftIndex);
        uint256 debtAmount = _getDebtAmount(_nftIndex);
        require(debtAmount + _amount <= creditLimit, "insufficient_credit");

        //calculate the borrow fee
        uint256 organizationFee = (_amount *
            settings.organizationFeeRate.numerator) /
            settings.organizationFeeRate.denominator;

        uint256 feeAmount = organizationFee;
        //if the position is insured, calculate the insurance fee
        if (position.borrowType == BorrowType.USE_INSURANCE || _useInsurance) {
            feeAmount +=
                (_amount * settings.insurancePurchaseRate.numerator) /
                settings.insurancePurchaseRate.denominator;
        }
        totalFeeCollected += feeAmount;
        //subtract the fee from the amount borrowed
        stablecoin.mint(msg.sender, _amount - feeAmount);

        if (position.borrowType == BorrowType.NOT_CONFIRMED) {
            position.borrowType = _useInsurance
                ? BorrowType.USE_INSURANCE
                : BorrowType.NON_INSURANCE;
        }

        // update debt portion
        if (totalDebtPortion == 0) {
            totalDebtPortion = _amount;
            position.debtPortion = _amount;
        } else {
            uint256 plusPortion = (totalDebtPortion * _amount) /
                totalDebtAmount;
            totalDebtPortion += plusPortion;
            position.debtPortion += plusPortion;
        }
        position.debtPrincipal += _amount;
        totalDebtAmount += _amount;

        emit Borrowed(msg.sender, _nftIndex, _amount);
    }

    /// @notice Allows users to repay a portion/all of their debt. Note that since interest increases every second,
    /// a user wanting to repay all of their debt should repay for an amount greater than their current debt to account for the
    /// additional interest while the repay transaction is pending, the contract will only take what's necessary to repay all the debt
    /// @dev Emits a {Repaid} event
    /// @param _nftIndex The NFT used as collateral for the position
    /// @param _amount The amount of debt to repay. If greater than the position's outstanding debt, only the amount necessary to repay all the debt will be taken
    function repay(uint256 _nftIndex, uint256 _amount)
        external
        validNFTIndex(_nftIndex)
        nonReentrant
    {
        accrue();

        require(msg.sender == positionOwner[_nftIndex], "unauthorized");
        require(_amount > 0, "invalid_amount");

        Position storage position = positions[_nftIndex];
        require(position.liquidatedAt == 0, "liquidated");

        uint256 debtAmount = _getDebtAmount(_nftIndex);
        require(debtAmount > 0, "position_not_borrowed");

        uint256 debtPrincipal = position.debtPrincipal;
        uint256 debtInterest = debtAmount - debtPrincipal;

        _amount = _amount > debtAmount ? debtAmount : _amount;

        // burn all payment, the interest is sent to the DAO using the {collect} function
        stablecoin.burnFrom(msg.sender, _amount);

        uint256 paidPrincipal = _amount > debtInterest
            ? _amount - debtInterest
            : 0;

        uint256 minusPortion = paidPrincipal == debtPrincipal
            ? position.debtPortion
            : (totalDebtPortion * _amount) / totalDebtAmount;

        totalDebtPortion -= minusPortion;
        position.debtPortion -= minusPortion;
        position.debtPrincipal -= paidPrincipal;
        totalDebtAmount -= _amount;

        emit Repaid(msg.sender, _nftIndex, _amount);
    }

    /// @notice Allows a user to close a position and get their collateral back, if the position's outstanding debt is 0
    /// @dev Emits a {PositionClosed} event
    /// @param _nftIndex The index of the NFT used as collateral
    function closePosition(uint256 _nftIndex)
        external
        validNFTIndex(_nftIndex)
    {
        accrue();

        require(msg.sender == positionOwner[_nftIndex], "unauthorized");
        require(_getDebtAmount(_nftIndex) == 0, "position_not_repaid");

        positionOwner[_nftIndex] = address(0);
        delete positions[_nftIndex];
        positionIndexes.remove(_nftIndex);

        // transfer nft back to owner if nft was deposited
        if (nftContract.ownerOf(_nftIndex) == address(this)) {
            nftContract.safeTransferFrom(address(this), msg.sender, _nftIndex);
        }

        emit PositionClosed(msg.sender, _nftIndex);
    }

    /// @notice Allows members of the `LIQUIDATOR_ROLE` to liquidate a position. Positions can only be liquidated
    /// once their debt amount exceeds the minimum liquidation debt to collateral value rate.
    /// In order to liquidate a position, the liquidator needs to repay the user's outstanding debt.
    /// If the position is not insured, it's closed immediately and the collateral is sent to the liquidator.
    /// If the position is insured, the position remains open (interest doesn't increase) and the owner of the position has a certain amount of time
    /// (`insuranceRepurchaseTimeLimit`) to fully repay the liquidator and pay an additional liquidation fee (`insuranceLiquidationPenaltyRate`), if this
    /// is done in time the user gets back their collateral and their position is automatically closed. If the user doesn't repurchase their collateral
    /// before the time limit passes, the liquidator can claim the liquidated NFT and the position is closed
    /// @dev Emits a {Liquidated} event
    /// @param _nftIndex The NFT to liquidate
    function liquidate(uint256 _nftIndex)
        external
        onlyRole(LIQUIDATOR_ROLE)
        validNFTIndex(_nftIndex)
        nonReentrant
    {
        accrue();

        address posOwner = positionOwner[_nftIndex];
        require(posOwner != address(0), "position_not_exist");

        Position storage position = positions[_nftIndex];
        require(position.liquidatedAt == 0, "liquidated");

        uint256 debtAmount = _getDebtAmount(_nftIndex);
        require(
            debtAmount >= _getLiquidationLimit(_nftIndex),
            "position_not_liquidatable"
        );

        // burn all payment
        stablecoin.burnFrom(msg.sender, debtAmount);

        // update debt portion
        totalDebtPortion -= position.debtPortion;
        totalDebtAmount -= debtAmount;
        position.debtPortion = 0;

        bool insured = position.borrowType == BorrowType.USE_INSURANCE;
        if (insured) {
            position.debtAmountForRepurchase = debtAmount;
            position.liquidatedAt = block.timestamp;
            position.liquidator = msg.sender;
        } else {
            // transfer nft to liquidator
            positionOwner[_nftIndex] = address(0);
            delete positions[_nftIndex];
            positionIndexes.remove(_nftIndex);
            nftContract.safeTransferFrom(address(this), msg.sender, _nftIndex);
        }

        emit Liquidated(msg.sender, posOwner, _nftIndex, insured);
    }

    /// @notice Allows liquidated users who purchased insurance to repurchase their collateral within the time limit
    /// defined with the `insuranceRepurchaseTimeLimit`. The user needs to pay the liquidator the total amount of debt
    /// the position had at the time of liquidation, plus an insurance liquidation fee defined with `insuranceLiquidationPenaltyRate`
    /// @dev Emits a {Repurchased} event
    /// @param _nftIndex The NFT to repurchase
    function repurchase(uint256 _nftIndex) external validNFTIndex(_nftIndex) {
        Position memory position = positions[_nftIndex];
        require(msg.sender == positionOwner[_nftIndex], "unauthorized");
        require(position.liquidatedAt > 0, "not_liquidated");
        require(
            position.borrowType == BorrowType.USE_INSURANCE,
            "non_insurance"
        );
        require(
            position.liquidatedAt + settings.insuraceRepurchaseTimeLimit >=
                block.timestamp,
            "insurance_expired"
        );

        uint256 debtAmount = position.debtAmountForRepurchase;
        uint256 penalty = (debtAmount *
            settings.insuranceLiquidationPenaltyRate.numerator) /
            settings.insuranceLiquidationPenaltyRate.denominator;

        // transfer payment to liquidator
        stablecoin.transferFrom(
            msg.sender,
            position.liquidator,
            debtAmount + penalty
        );

        // transfer nft to user
        positionOwner[_nftIndex] = address(0);
        delete positions[_nftIndex];
        positionIndexes.remove(_nftIndex);

        nftContract.safeTransferFrom(address(this), msg.sender, _nftIndex);

        emit Repurchased(msg.sender, _nftIndex);
    }

    /// @notice Allows the liquidator who liquidated the insured position with NFT at index `_nftIndex` to claim the position's collateral
    /// after the time period defined with `insuranceRepurchaseTimeLimit` has expired and the position owner has not repurchased the collateral.
    /// @dev Emits an {InsuranceExpired} event
    /// @param _nftIndex The NFT to claim
    function claimExpiredInsuranceNFT(uint256 _nftIndex)
        external
        validNFTIndex(_nftIndex)
    {
        Position memory position = positions[_nftIndex];
        address owner = positionOwner[_nftIndex];
        require(address(0) != owner, "no_position");
        require(position.liquidatedAt > 0, "not_liquidated");
        require(
            position.liquidatedAt + settings.insuraceRepurchaseTimeLimit <
                block.timestamp,
            "insurance_not_expired"
        );
        require(position.liquidator == msg.sender, "unauthorized");

        positionOwner[_nftIndex] = address(0);
        delete positions[_nftIndex];
        positionIndexes.remove(_nftIndex);

        nftContract.safeTransferFrom(address(this), msg.sender, _nftIndex);

        emit InsuranceExpired(owner, _nftIndex);
    }

    /// @notice Allows the DAO to collect interest and fees before they are repaid
    function collect() external nonReentrant onlyRole(DAO_ROLE) {
        accrue();
        stablecoin.mint(msg.sender, totalFeeCollected);
        totalFeeCollected = 0;
    }

    uint256[50] private __gap;
}
