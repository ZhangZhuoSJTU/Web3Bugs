pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "../libraries/openzeppelin-upgradeability/VersionedInitializable.sol";
import "../configuration/LendingPoolAddressesProvider.sol";
import "./LendingPoolCore.sol";
import "../tokenization/AToken.sol";

/**
* @title LendingPoolConfigurator contract
* @author Aave
* @notice Executes configuration methods on the LendingPoolCore contract. Allows to enable/disable reserves,
* and set different protocol parameters.
**/

contract LendingPoolConfigurator is VersionedInitializable {
    using SafeMath for uint256;

    /**
    * @dev emitted when a reserve is initialized.
    * @param _reserve the address of the reserve
    * @param _aToken the address of the overlying aToken contract
    * @param _interestRateStrategyAddress the address of the interest rate strategy for the reserve
    **/
    event ReserveInitialized(
        address indexed _reserve,
        address indexed _aToken,
        address _interestRateStrategyAddress
    );

    /**
    * @dev emitted when a reserve is removed.
    * @param _reserve the address of the reserve
    **/
    event ReserveRemoved(
        address indexed _reserve
    );

    /**
    * @dev emitted when borrowing is enabled on a reserve
    * @param _reserve the address of the reserve
    * @param _stableRateEnabled true if stable rate borrowing is enabled, false otherwise
    **/
    event BorrowingEnabledOnReserve(address _reserve, bool _stableRateEnabled);

    /**
    * @dev emitted when borrowing is disabled on a reserve
    * @param _reserve the address of the reserve
    **/
    event BorrowingDisabledOnReserve(address indexed _reserve);

    /**
    * @dev emitted when a reserve is enabled as collateral.
    * @param _reserve the address of the reserve
    * @param _ltv the loan to value of the asset when used as collateral
    * @param _liquidationThreshold the threshold at which loans using this asset as collateral will be considered undercollateralized
    * @param _liquidationBonus the bonus liquidators receive to liquidate this asset
    **/
    event ReserveEnabledAsCollateral(
        address indexed _reserve,
        uint256 _ltv,
        uint256 _liquidationThreshold,
        uint256 _liquidationBonus
    );

    /**
    * @dev emitted when a reserve is disabled as collateral
    * @param _reserve the address of the reserve
    **/
    event ReserveDisabledAsCollateral(address indexed _reserve);

    /**
    * @dev emitted when stable rate borrowing is enabled on a reserve
    * @param _reserve the address of the reserve
    **/
    event StableRateEnabledOnReserve(address indexed _reserve);

    /**
    * @dev emitted when stable rate borrowing is disabled on a reserve
    * @param _reserve the address of the reserve
    **/
    event StableRateDisabledOnReserve(address indexed _reserve);

    /**
    * @dev emitted when a reserve is activated
    * @param _reserve the address of the reserve
    **/
    event ReserveActivated(address indexed _reserve);

    /**
    * @dev emitted when a reserve is deactivated
    * @param _reserve the address of the reserve
    **/
    event ReserveDeactivated(address indexed _reserve);

    /**
    * @dev emitted when a reserve is freezed
    * @param _reserve the address of the reserve
    **/
    event ReserveFreezed(address indexed _reserve);

    /**
    * @dev emitted when a reserve is unfreezed
    * @param _reserve the address of the reserve
    **/
    event ReserveUnfreezed(address indexed _reserve);

    /**
    * @dev emitted when a reserve loan to value is updated
    * @param _reserve the address of the reserve
    * @param _ltv the new value for the loan to value
    **/
    event ReserveBaseLtvChanged(address _reserve, uint256 _ltv);

    /**
    * @dev emitted when a reserve liquidation threshold is updated
    * @param _reserve the address of the reserve
    * @param _threshold the new value for the liquidation threshold
    **/
    event ReserveLiquidationThresholdChanged(address _reserve, uint256 _threshold);

    /**
    * @dev emitted when a reserve liquidation bonus is updated
    * @param _reserve the address of the reserve
    * @param _bonus the new value for the liquidation bonus
    **/
    event ReserveLiquidationBonusChanged(address _reserve, uint256 _bonus);

    /**
    * @dev emitted when the reserve decimals are updated
    * @param _reserve the address of the reserve
    * @param _decimals the new decimals
    **/
    event ReserveDecimalsChanged(address _reserve, uint256 _decimals);


    /**
    * @dev emitted when a reserve interest strategy contract is updated
    * @param _reserve the address of the reserve
    * @param _strategy the new address of the interest strategy contract
    **/
    event ReserveInterestRateStrategyChanged(address _reserve, address _strategy);

    LendingPoolAddressesProvider public poolAddressesProvider;
    /**
    * @dev only the lending pool manager can call functions affected by this modifier
    **/
    modifier onlyLendingPoolManager {
        require(
            poolAddressesProvider.getLendingPoolManager() == msg.sender,
            "The caller must be a lending pool manager"
        );
        _;
    }

    uint256 public constant CONFIGURATOR_REVISION = 0x3;

    function getRevision() internal pure returns (uint256) {
        return CONFIGURATOR_REVISION;
    }

    function initialize(LendingPoolAddressesProvider _poolAddressesProvider) public initializer {
        poolAddressesProvider = _poolAddressesProvider;
    }

    /**
    * @dev initializes a reserve
    * @param _reserve the address of the reserve to be initialized
    * @param _underlyingAssetDecimals the decimals of the reserve underlying asset
    * @param _interestRateStrategyAddress the address of the interest rate strategy contract for this reserve
    **/
    function initReserve(
        address _reserve,
        uint8 _underlyingAssetDecimals,
        address _interestRateStrategyAddress
    ) external onlyLendingPoolManager {
        ERC20Detailed asset = ERC20Detailed(_reserve);

        string memory aTokenName = string(abi.encodePacked("Aave Interest bearing ", asset.name()));
        string memory aTokenSymbol = string(abi.encodePacked("a", asset.symbol()));

        initReserveWithData(
            _reserve,
            aTokenName,
            aTokenSymbol,
            _underlyingAssetDecimals,
            _interestRateStrategyAddress
        );

    }

    /**
    * @dev initializes a reserve using aTokenData provided externally (useful if the underlying ERC20 contract doesn't expose name or decimals)
    * @param _reserve the address of the reserve to be initialized
    * @param _aTokenName the name of the aToken contract
    * @param _aTokenSymbol the symbol of the aToken contract
    * @param _underlyingAssetDecimals the decimals of the reserve underlying asset
    * @param _interestRateStrategyAddress the address of the interest rate strategy contract for this reserve
    **/
    function initReserveWithData(
        address _reserve,
        string memory _aTokenName,
        string memory _aTokenSymbol,
        uint8 _underlyingAssetDecimals,
        address _interestRateStrategyAddress
    ) public onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());

        AToken aTokenInstance = new AToken(
            poolAddressesProvider,
            _reserve,
            _underlyingAssetDecimals,
            _aTokenName,
            _aTokenSymbol
        );
        core.initReserve(
            _reserve,
            address(aTokenInstance),
            _underlyingAssetDecimals,
            _interestRateStrategyAddress
        );

        emit ReserveInitialized(
            _reserve,
            address(aTokenInstance),
            _interestRateStrategyAddress
        );
    }

    /**
    * @dev removes the last added reserve in the list of the reserves
    * @param _reserveToRemove the address of the reserve
    **/
    function removeLastAddedReserve( address _reserveToRemove) external onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.removeLastAddedReserve(_reserveToRemove);
        emit ReserveRemoved(_reserveToRemove);
    }

    /**
    * @dev enables borrowing on a reserve
    * @param _reserve the address of the reserve
    * @param _stableBorrowRateEnabled true if stable borrow rate needs to be enabled by default on this reserve
    **/
    function enableBorrowingOnReserve(address _reserve, bool _stableBorrowRateEnabled)
    external
    onlyLendingPoolManager
    {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.enableBorrowingOnReserve(_reserve, _stableBorrowRateEnabled);
        emit BorrowingEnabledOnReserve(_reserve, _stableBorrowRateEnabled);
    }

    /**
    * @dev disables borrowing on a reserve
    * @param _reserve the address of the reserve
    **/
    function disableBorrowingOnReserve(address _reserve) external onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.disableBorrowingOnReserve(_reserve);

        emit BorrowingDisabledOnReserve(_reserve);
    }

    /**
    * @dev enables a reserve to be used as collateral
    * @param _reserve the address of the reserve
    * @param _baseLTVasCollateral the loan to value of the asset when used as collateral
    * @param _liquidationThreshold the threshold at which loans using this asset as collateral will be considered undercollateralized
    * @param _liquidationBonus the bonus liquidators receive to liquidate this asset
    **/
    function enableReserveAsCollateral(
        address _reserve,
        uint256 _baseLTVasCollateral,
        uint256 _liquidationThreshold,
        uint256 _liquidationBonus
    ) external onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.enableReserveAsCollateral(
            _reserve,
            _baseLTVasCollateral,
            _liquidationThreshold,
            _liquidationBonus
        );
        emit ReserveEnabledAsCollateral(
            _reserve,
            _baseLTVasCollateral,
            _liquidationThreshold,
            _liquidationBonus
        );
    }

    /**
    * @dev disables a reserve as collateral
    * @param _reserve the address of the reserve
    **/
    function disableReserveAsCollateral(address _reserve) external onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.disableReserveAsCollateral(_reserve);

        emit ReserveDisabledAsCollateral(_reserve);
    }

    /**
    * @dev enable stable rate borrowing on a reserve
    * @param _reserve the address of the reserve
    **/
    function enableReserveStableBorrowRate(address _reserve) external onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.enableReserveStableBorrowRate(_reserve);

        emit StableRateEnabledOnReserve(_reserve);
    }

    /**
    * @dev disable stable rate borrowing on a reserve
    * @param _reserve the address of the reserve
    **/
    function disableReserveStableBorrowRate(address _reserve) external onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.disableReserveStableBorrowRate(_reserve);

        emit StableRateDisabledOnReserve(_reserve);
    }

    /**
    * @dev activates a reserve
    * @param _reserve the address of the reserve
    **/
    function activateReserve(address _reserve) external onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.activateReserve(_reserve);

        emit ReserveActivated(_reserve);
    }

    /**
    * @dev deactivates a reserve
    * @param _reserve the address of the reserve
    **/
    function deactivateReserve(address _reserve) external onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        require(core.getReserveTotalLiquidity(_reserve) == 0, "The liquidity of the reserve needs to be 0");
        core.deactivateReserve(_reserve);

        emit ReserveDeactivated(_reserve);
    }

    /**
    * @dev freezes a reserve. A freezed reserve doesn't accept any new deposit, borrow or rate swap, but can accept repayments, liquidations, rate rebalances and redeems
    * @param _reserve the address of the reserve
    **/
    function freezeReserve(address _reserve) external onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.freezeReserve(_reserve);

        emit ReserveFreezed(_reserve);
    }

    /**
    * @dev unfreezes a reserve
    * @param _reserve the address of the reserve
    **/
    function unfreezeReserve(address _reserve) external onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.unfreezeReserve(_reserve);

        emit ReserveUnfreezed(_reserve);
    }

    /**
    * @dev emitted when a reserve loan to value is updated
    * @param _reserve the address of the reserve
    * @param _ltv the new value for the loan to value
    **/
    function setReserveBaseLTVasCollateral(address _reserve, uint256 _ltv)
    external
    onlyLendingPoolManager
    {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.setReserveBaseLTVasCollateral(_reserve, _ltv);
        emit ReserveBaseLtvChanged(_reserve, _ltv);
    }

    /**
    * @dev updates the liquidation threshold of a reserve.
    * @param _reserve the address of the reserve
    * @param _threshold the new value for the liquidation threshold
    **/
    function setReserveLiquidationThreshold(address _reserve, uint256 _threshold)
    external
    onlyLendingPoolManager
    {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.setReserveLiquidationThreshold(_reserve, _threshold);
        emit ReserveLiquidationThresholdChanged(_reserve, _threshold);
    }

    /**
    * @dev updates the liquidation bonus of a reserve
    * @param _reserve the address of the reserve
    * @param _bonus the new value for the liquidation bonus
    **/
    function setReserveLiquidationBonus(address _reserve, uint256 _bonus)
    external
    onlyLendingPoolManager
    {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.setReserveLiquidationBonus(_reserve, _bonus);
        emit ReserveLiquidationBonusChanged(_reserve, _bonus);
    }

    /**
    * @dev updates the reserve decimals
    * @param _reserve the address of the reserve
    * @param _decimals the new number of decimals
    **/
    function setReserveDecimals(address _reserve, uint256 _decimals)
    external
    onlyLendingPoolManager
    {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.setReserveDecimals(_reserve, _decimals);
        emit ReserveDecimalsChanged(_reserve, _decimals);
    }

    /**
    * @dev sets the interest rate strategy of a reserve
    * @param _reserve the address of the reserve
    * @param _rateStrategyAddress the new address of the interest strategy contract
    **/
    function setReserveInterestRateStrategyAddress(address _reserve, address _rateStrategyAddress)
    external
    onlyLendingPoolManager
    {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.setReserveInterestRateStrategyAddress(_reserve, _rateStrategyAddress);
        emit ReserveInterestRateStrategyChanged(_reserve, _rateStrategyAddress);
    }

    /**
    * @dev refreshes the lending pool core configuration to update the cached address
    **/
    function refreshLendingPoolCoreConfiguration() external onlyLendingPoolManager {
        LendingPoolCore core = LendingPoolCore(poolAddressesProvider.getLendingPoolCore());
        core.refreshConfiguration();
    }
}
