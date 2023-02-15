// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import {SafeERC20Upgradeable} from "openzeppelin-contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {ReentrancyGuardUpgradeable} from "openzeppelin-contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./interfaces/badger/IVault.sol";
import "./interfaces/erc20/IERC20.sol";
import "./lib/GlobalAccessControlManaged.sol";
import "./lib/SafeERC20.sol";
import "./interfaces/citadel/IMedianOracle.sol";

/**
 * @notice Sells a token at a predetermined price to whitelisted buyers.
 * TODO: Better revert strings
 */
contract Funding is GlobalAccessControlManaged, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // Roles used from GAC
    bytes32 public constant CONTRACT_GOVERNANCE_ROLE =
        keccak256("CONTRACT_GOVERNANCE_ROLE");
    bytes32 public constant POLICY_OPERATIONS_ROLE =
        keccak256("POLICY_OPERATIONS_ROLE");
    bytes32 public constant TREASURY_OPERATIONS_ROLE = keccak256("TREASURY_OPERATIONS_ROLE");
    bytes32 public constant TREASURY_VAULT_ROLE =
        keccak256("TREASURY_VAULT_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    uint256 public constant MAX_BPS = 10000;

    IERC20 public citadel; /// token to distribute (in vested xCitadel form)
    IVault public xCitadel; /// wrapped citadel form that is actually distributed
    IERC20 public asset; /// token to take in WBTC / bibbtc LP / CVX / bveCVX

    uint256 public citadelPriceInAsset; /// asset per citadel price eg. 1 WBTC (8 decimals) = 40,000 CTDL ==> price = 10^8 / 40,000
    uint256 public minCitadelPriceInAsset; /// Lower bound on expected citadel price in asset terms. Used as circuit breaker oracle.
    uint256 public maxCitadelPriceInAsset; /// Upper bound on expected citadel price in asset terms. Used as circuit breaker oracle.
    bool public citadelPriceFlag; /// Flag citadel price for review by guardian if it exceeds min and max bounds;

    uint256 public assetDecimalsNormalizationValue;

    address public citadelPriceInAssetOracle;
    address public saleRecipient;

    struct FundingParams {
        uint256 discount;
        uint256 minDiscount;
        uint256 maxDiscount;
        address discountManager;
        uint256 assetCumulativeFunded; /// persistent sum of asset amount in over lifetime of contract.
        uint256 assetCap; /// Max asset token that can be taken in by the contract (defines the cap for citadel sold)
    }

    FundingParams public funding;

    /// ==================
    /// ===== Events =====
    /// ==================

    // TODO: we should conform to some interface here
    event Deposit(
        address indexed buyer,
        uint256 assetIn,
        uint256 citadelOutValue
    );

    event CitadelPriceInAssetUpdated(uint256 citadelPrice);

    event CitadelPriceBoundsSet(uint256 minPrice, uint256 maxPrice);
    event CitadelPriceFlag(uint256 price, uint256 minPrice, uint256 maxPrice);

    event SaleRecipientUpdated(address indexed recipient);
    event AssetCapUpdated(uint256 assetCap);

    event Sweep(address indexed token, uint256 amount);
    event ClaimToTreasury(address indexed token, uint256 amount);

    modifier onlyCitadelPriceInAssetOracle() {
        require(
            msg.sender == citadelPriceInAssetOracle,
            "onlyCitadelPriceInAssetOracle"
        );
        _;
    }

    event DiscountLimitsSet(uint256 minDiscount, uint256 maxDiscount);
    event DiscountSet(uint256 discount);
    event DiscountManagerSet(address discountManager);

    /// =======================
    /// ===== Initializer =====
    /// =======================

    /**
     * @notice Initializer.
     * @param _gac Global access control
     * @param _citadel The token this contract will return in a trade
     * @param _asset The token this contract will receive in a trade
     * @param _xCitadel Staked citadel, citadel will be granted to funders in this form
     * @param _saleRecipient The address receiving the proceeds of the sale - will be citadel multisig
     * @param _assetCap The max asset that the contract can take
     */
    function initialize(
        address _gac,
        address _citadel,
        address _asset,
        address _xCitadel,
        address _saleRecipient,
        address _citadelPriceInAssetOracle,
        uint256 _assetCap
    ) external initializer {
        require(
            _saleRecipient != address(0),
            "Funding: 0 sale"
        );
        require(
            _citadelPriceInAssetOracle != address(0),
            "Funding: 0 oracle"
        );

        __GlobalAccessControlManaged_init(_gac);
        __ReentrancyGuard_init();

        citadel = IERC20(_citadel);
        xCitadel = IVault(_xCitadel);
        asset = IERC20(_asset);
        saleRecipient = _saleRecipient;

        citadelPriceInAssetOracle = _citadelPriceInAssetOracle;

        funding = FundingParams(0, 0, 0, address(0), 0, _assetCap);

        assetDecimalsNormalizationValue = 10**asset.decimals();

        // No circuit breaker on price by default
        minCitadelPriceInAsset = 0;
        maxCitadelPriceInAsset = type(uint256).max;

        // Allow to deposit in vault
        // Done last for reEntrancy concerns
        IERC20(_citadel).safeApprove(address(_xCitadel), type(uint256).max);
    }

    modifier onlyWhenPriceNotFlagged() {
        require(
            citadelPriceFlag == false,
            "Funding: citadel price from oracle flagged and pending review"
        );
        _;
    }

    /// ==========================
    /// ===== Public actions =====
    /// ==========================

    /**
     * @notice Exchange `_assetAmountIn` of `asset` for `citadel`
     * @param _assetAmountIn Amount of `asset` to give
     * @param _minCitadelOut ID of DAO to vote for
     * @return citadelAmount_ Amount of `xCitadel` bought
     */
    function deposit(uint256 _assetAmountIn, uint256 _minCitadelOut)
        external
        onlyWhenPriceNotFlagged
        gacPausable
        nonReentrant
        returns (uint256 citadelAmount_)
    {
        require(_assetAmountIn > 0, "_assetAmountIn must not be 0");
        require(
            funding.assetCumulativeFunded + _assetAmountIn <= funding.assetCap,
            "asset funding cap exceeded"
        );
        funding.assetCumulativeFunded = funding.assetCumulativeFunded + _assetAmountIn;
        // Take in asset from user
        citadelAmount_ = getAmountOut(_assetAmountIn);
        require(citadelAmount_ >= _minCitadelOut, "minCitadelOut");

        asset.safeTransferFrom(msg.sender, saleRecipient, _assetAmountIn);
        
        // Deposit xCitadel and send to user
        // TODO: Check gas costs. How does this relate to market buying if you do want to deposit to xCTDL?
        xCitadel.depositFor(msg.sender, citadelAmount_);

        emit Deposit(
            msg.sender,
            _assetAmountIn,
            citadelAmount_
        );
    }

    /// =======================
    /// ===== Public view =====
    /// =======================

    /**
     * @notice Get the amount received when exchanging `asset`
     * @param _assetAmountIn Amount of `asset` to exchange
     * @return citadelAmount_ Amount of `citadel` received
     */
    function getAmountOut(uint256 _assetAmountIn)
        public
        view
        returns (uint256 citadelAmount_)
    {
        uint256 citadelAmountWithoutDiscount = _assetAmountIn * citadelPriceInAsset;

        if (funding.discount > 0) {
            citadelAmount_ =
                (citadelAmountWithoutDiscount * MAX_BPS) /
                (MAX_BPS - funding.discount);
        }

        citadelAmount_ = citadelAmount_ / assetDecimalsNormalizationValue;
    }

    /**
     * @notice Get the amount received when exchanging `asset`, in terms of xCitadel at current price per share
     * @param _assetAmountIn Amount of `asset` to exchange
     * @return xCitadelAmount_ Amount of `xCitadel` received at current price per share
     */
    function getStakedCitadelAmountOut(uint256 _assetAmountIn) public view returns (uint256 xCitadelAmount_) {
        uint citadelAmount = getAmountOut(_assetAmountIn);
        xCitadelAmount_ = citadelAmount * 10**citadel.decimals() / xCitadel.getPricePerFullShare();
    }

    /**
     * @notice Check how much `asset` can still be taken in, based on cap and cumulative amount funded
     * @return limitLeft_ Amount of `asset` that can still be exchanged for citadel
     */
    function getRemainingFundable() external view returns (uint256 limitLeft_) {
        uint256 assetCumulativeFunded = funding.assetCumulativeFunded;
        uint256 assetCap = funding.assetCap;
        if (assetCumulativeFunded < assetCap) {
            limitLeft_ = assetCap - assetCumulativeFunded;
        }
    }

    /**
     * @notice Get all funding params
     * @return funding all funding params
     */
    function getFundingParams() external view returns (FundingParams memory) {
        return funding;
    }

    /**
     * @notice Convenience function to get current discount rate
     * @return discount current discount rate
     */
    function getDiscount() external view returns (uint256) {
        return funding.discount;
    }

    /// ==============================
    /// ===== Policy Ops actions =====
    /// ==============================

    /**
     * @notice Set discount manually, within the constraints of min and max discount values
     * @dev managed by policy operations for rapid response to market conditions
     * @param _discount active discount (in bps)
     */
    function setDiscount(uint256 _discount)
        external
        gacPausable
        onlyRoleOrAddress(POLICY_OPERATIONS_ROLE, funding.discountManager)
    {
        require(_discount >= funding.minDiscount, "discount < minDiscount");
        require(_discount <= funding.maxDiscount, "discount > maxDiscount");

        funding.discount = _discount;

        emit DiscountSet(_discount);
    }

    function clearCitadelPriceFlag()
        external
        gacPausable
        onlyRole(POLICY_OPERATIONS_ROLE)
    {
        citadelPriceFlag = false;
    }

    /**
     * @notice Modify the max asset amount that this contract can take. Managed by policy governance.
     * @dev This is cumulative asset cap, so must take into account the asset amount already funded.
     * @param _assetCap New max cumulatiive amountIn
     */
    function setAssetCap(uint256 _assetCap)
        external
        gacPausable
        onlyRole(POLICY_OPERATIONS_ROLE)
    {
        require(
            _assetCap > funding.assetCumulativeFunded,
            "cannot decrease cap below global sum of assets in"
        );
        funding.assetCap = _assetCap;
        emit AssetCapUpdated(_assetCap);
    }

    /// ================================
    /// ===== Treasury Ops actions =====
    /// ================================

    /**
     * @notice Transfers out any tokens accidentally sent to the contract. Can only be called by owner
     * @dev The contract transfers all `asset` directly to `saleRecipient` during a sale so it's safe
     *      to sweep `asset`. For `citadel`, the function only sweeps the extra amount
     *      (current contract balance - amount left to be claimed)
     * @param _token The token to sweep
     */
    function sweep(address _token)
        external
        gacPausable
        nonReentrant
        onlyRole(TREASURY_OPERATIONS_ROLE)
    {
        uint256 amount = IERC20(_token).balanceOf(address(this));
        require(amount > 0, "nothing to sweep");
        require(
            _token != address(asset),
            "cannot sweep funding asset, use claimAssetToTreasury()"
        );

        emit Sweep(_token, amount);
        IERC20(_token).safeTransfer(saleRecipient, amount);
    }

    /// @notice Claim accumulated asset token to treasury
    /// @dev We let assets accumulate and batch transfer to treasury (rather than transfer atomically on each deposi)t for user gas savings
    function claimAssetToTreasury()
        external
        gacPausable
        onlyRole(TREASURY_OPERATIONS_ROLE)
    {
        uint256 amount = asset.balanceOf(address(this));
        require(amount > 0, "nothing to claim");
        asset.safeTransfer(saleRecipient, amount);

        emit ClaimToTreasury(address(asset), amount);
    }

    /// ==============================
    /// ===== Governance actions =====
    /// ==============================

    /**
     * @notice Set minimum and maximum discount
     * @dev managed by contract governance to place constraints around the parameter for policy operations to play within
     * @param _minDiscount minimum discount (in bps)
     * @param _maxDiscount maximum discount (in bps)
     */
    function setDiscountLimits(uint256 _minDiscount, uint256 _maxDiscount)
        external
        gacPausable
        onlyRole(CONTRACT_GOVERNANCE_ROLE)
    {
        require(_maxDiscount < MAX_BPS , "maxDiscount >= MAX_BPS");
        funding.minDiscount = _minDiscount;
        funding.maxDiscount = _maxDiscount;

        emit DiscountLimitsSet(_minDiscount, _maxDiscount);
    }

    /**
     * @notice Set a discount manager address
     * @dev This is intended to be used for an automated discount manager contract to supplement or replace manual calls
     * @param _discountManager discount manager address
     */
    function setDiscountManager(address _discountManager)
        external
        gacPausable
        onlyRole(CONTRACT_GOVERNANCE_ROLE)
    {
        funding.discountManager = _discountManager;

        emit DiscountManagerSet(_discountManager);
    }

    function setSaleRecipient(address _saleRecipient)
        external
        gacPausable
        onlyRole(CONTRACT_GOVERNANCE_ROLE)
    {
        require(
            _saleRecipient != address(0),
            "Funding: sale recipient should not be zero"
        );

        saleRecipient = _saleRecipient;
        emit SaleRecipientUpdated(_saleRecipient);
    }

    function setCitadelAssetPriceBounds(uint256 _minPrice, uint256 _maxPrice)
        external
        gacPausable
        onlyRole(CONTRACT_GOVERNANCE_ROLE)
    {
        minCitadelPriceInAsset = _minPrice;
        maxCitadelPriceInAsset = _maxPrice;

        emit CitadelPriceBoundsSet(_minPrice, _maxPrice);
    }

    /// ==========================
    /// ===== Oracle actions =====
    /// ==========================

    /// @notice Update citadel price in asset terms from oracle source
    /// @dev Note that the oracle mechanics are abstracted to the oracle address
    function updateCitadelPriceInAsset()
        external
        gacPausable
        onlyRole(KEEPER_ROLE)
    {   
        uint _citadelPriceInAsset;
        bool _valid;

        (_citadelPriceInAsset, _valid) = IMedianOracle(citadelPriceInAssetOracle).getData();

        require(_citadelPriceInAsset > 0, "citadel price must not be zero");
        require(_valid, "oracle data must be valid");

        if (
            _citadelPriceInAsset < minCitadelPriceInAsset ||
            _citadelPriceInAsset > maxCitadelPriceInAsset
        ) {
            citadelPriceFlag = true;
            emit CitadelPriceFlag(
                _citadelPriceInAsset,
                minCitadelPriceInAsset,
                maxCitadelPriceInAsset
            );
        } else {
            citadelPriceInAsset = _citadelPriceInAsset;
            emit CitadelPriceInAssetUpdated(_citadelPriceInAsset);
        }
    }


    /// @dev OUT OF AUDIT SCOPE: This is a test function that will be removed in final code
    /// @notice Update citadel price in asset terms from oracle source
    /// @dev Note that the oracle mechanics are abstracted to the oracle address
    function updateCitadelPriceInAsset(uint256 _citadelPriceInAsset)
        external
        gacPausable
        onlyCitadelPriceInAssetOracle
    {
        require(_citadelPriceInAsset > 0, "citadel price must not be zero");

        if (
            _citadelPriceInAsset < minCitadelPriceInAsset ||
            _citadelPriceInAsset > maxCitadelPriceInAsset
        ) {
            citadelPriceFlag = true;
            emit CitadelPriceFlag(
                _citadelPriceInAsset,
                minCitadelPriceInAsset,
                maxCitadelPriceInAsset
            );
        } else {
            citadelPriceInAsset = _citadelPriceInAsset;
            emit CitadelPriceInAssetUpdated(_citadelPriceInAsset);
        }
    }
}
