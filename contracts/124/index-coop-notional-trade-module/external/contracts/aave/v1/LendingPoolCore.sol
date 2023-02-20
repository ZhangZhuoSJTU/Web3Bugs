pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";
import "../libraries/openzeppelin-upgradeability/VersionedInitializable.sol";

import "../libraries/CoreLibrary.sol";
import "../configuration/LendingPoolAddressesProvider.sol";
import "../interfaces/ILendingRateOracle.sol";
import "../interfaces/IReserveInterestRateStrategy.sol";
import "../libraries/WadRayMath.sol";
import "../tokenization/AToken.sol";
import "../libraries/EthAddressLib.sol";

/**
* @title LendingPoolCore contract
* @author Aave
* @notice Holds the state of the lending pool and all the funds deposited
* @dev NOTE: The core does not enforce security checks on the update of the state
* (eg, updateStateOnBorrow() does not enforce that borrowed is enabled on the reserve).
* The check that an action can be performed is a duty of the overlying LendingPool contract.
**/

contract LendingPoolCore is VersionedInitializable {
    using SafeMath for uint256;
    using WadRayMath for uint256;
    using CoreLibrary for CoreLibrary.ReserveData;
    using CoreLibrary for CoreLibrary.UserReserveData;
    using SafeERC20 for ERC20;
    using Address for address payable;

    /**
    * @dev Emitted when the state of a reserve is updated
    * @param reserve the address of the reserve
    * @param liquidityRate the new liquidity rate
    * @param stableBorrowRate the new stable borrow rate
    * @param variableBorrowRate the new variable borrow rate
    * @param liquidityIndex the new liquidity index
    * @param variableBorrowIndex the new variable borrow index
    **/
    event ReserveUpdated(
        address indexed reserve,
        uint256 liquidityRate,
        uint256 stableBorrowRate,
        uint256 variableBorrowRate,
        uint256 liquidityIndex,
        uint256 variableBorrowIndex
    );

    address public lendingPoolAddress;

    LendingPoolAddressesProvider public addressesProvider;

    /**
    * @dev only lending pools can use functions affected by this modifier
    **/
    modifier onlyLendingPool {
        require(lendingPoolAddress == msg.sender, "The caller must be a lending pool contract");
        _;
    }

    /**
    * @dev only lending pools configurator can use functions affected by this modifier
    **/
    modifier onlyLendingPoolConfigurator {
        require(
            addressesProvider.getLendingPoolConfigurator() == msg.sender,
            "The caller must be a lending pool configurator contract"
        );
        _;
    }

    mapping(address => CoreLibrary.ReserveData) internal reserves;
    mapping(address => mapping(address => CoreLibrary.UserReserveData)) internal usersReserveData;

    address[] public reservesList;

    uint256 public constant CORE_REVISION = 0x4;

    /**
    * @dev returns the revision number of the contract
    **/
    function getRevision() internal pure returns (uint256) {
        return CORE_REVISION;
    }

    /**
    * @dev initializes the Core contract, invoked upon registration on the AddressesProvider
    * @param _addressesProvider the addressesProvider contract
    **/

    function initialize(LendingPoolAddressesProvider _addressesProvider) public initializer {
        addressesProvider = _addressesProvider;
        refreshConfigInternal();
    }

    /**
    * @dev updates the state of the core as a result of a deposit action
    * @param _reserve the address of the reserve in which the deposit is happening
    * @param _user the address of the the user depositing
    * @param _amount the amount being deposited
    * @param _isFirstDeposit true if the user is depositing for the first time
    **/

    function updateStateOnDeposit(
        address _reserve,
        address _user,
        uint256 _amount,
        bool _isFirstDeposit
    ) external onlyLendingPool {
        reserves[_reserve].updateCumulativeIndexes();
        updateReserveInterestRatesAndTimestampInternal(_reserve, _amount, 0);

        if (_isFirstDeposit) {
            //if this is the first deposit of the user, we configure the deposit as enabled to be used as collateral
            setUserUseReserveAsCollateral(_reserve, _user, true);
        }
    }

    /**
    * @dev updates the state of the core as a result of a redeem action
    * @param _reserve the address of the reserve in which the redeem is happening
    * @param _user the address of the the user redeeming
    * @param _amountRedeemed the amount being redeemed
    * @param _userRedeemedEverything true if the user is redeeming everything
    **/
    function updateStateOnRedeem(
        address _reserve,
        address _user,
        uint256 _amountRedeemed,
        bool _userRedeemedEverything
    ) external onlyLendingPool {
        //compound liquidity and variable borrow interests
        reserves[_reserve].updateCumulativeIndexes();
        updateReserveInterestRatesAndTimestampInternal(_reserve, 0, _amountRedeemed);

        //if user redeemed everything the useReserveAsCollateral flag is reset
        if (_userRedeemedEverything) {
            setUserUseReserveAsCollateral(_reserve, _user, false);
        }
    }

    /**
    * @dev updates the state of the core as a result of a flashloan action
    * @param _reserve the address of the reserve in which the flashloan is happening
    * @param _income the income of the protocol as a result of the action
    **/
    function updateStateOnFlashLoan(
        address _reserve,
        uint256 _availableLiquidityBefore,
        uint256 _income,
        uint256 _protocolFee
    ) external onlyLendingPool {
        transferFlashLoanProtocolFeeInternal(_reserve, _protocolFee);

        //compounding the cumulated interest
        reserves[_reserve].updateCumulativeIndexes();

        uint256 totalLiquidityBefore = _availableLiquidityBefore.add(
            getReserveTotalBorrows(_reserve)
        );

        //compounding the received fee into the reserve
        reserves[_reserve].cumulateToLiquidityIndex(totalLiquidityBefore, _income);

        //refresh interest rates
        updateReserveInterestRatesAndTimestampInternal(_reserve, _income, 0);
    }

    /**
    * @dev updates the state of the core as a consequence of a borrow action.
    * @param _reserve the address of the reserve on which the user is borrowing
    * @param _user the address of the borrower
    * @param _amountBorrowed the new amount borrowed
    * @param _borrowFee the fee on the amount borrowed
    * @param _rateMode the borrow rate mode (stable, variable)
    * @return the new borrow rate for the user
    **/
    function updateStateOnBorrow(
        address _reserve,
        address _user,
        uint256 _amountBorrowed,
        uint256 _borrowFee,
        CoreLibrary.InterestRateMode _rateMode
    ) external onlyLendingPool returns (uint256, uint256) {
        // getting the previous borrow data of the user
        (uint256 principalBorrowBalance, , uint256 balanceIncrease) = getUserBorrowBalances(
            _reserve,
            _user
        );

        updateReserveStateOnBorrowInternal(
            _reserve,
            _user,
            principalBorrowBalance,
            balanceIncrease,
            _amountBorrowed,
            _rateMode
        );

        updateUserStateOnBorrowInternal(
            _reserve,
            _user,
            _amountBorrowed,
            balanceIncrease,
            _borrowFee,
            _rateMode
        );

        updateReserveInterestRatesAndTimestampInternal(_reserve, 0, _amountBorrowed);

        return (getUserCurrentBorrowRate(_reserve, _user), balanceIncrease);
    }

    /**
    * @dev updates the state of the core as a consequence of a repay action.
    * @param _reserve the address of the reserve on which the user is repaying
    * @param _user the address of the borrower
    * @param _paybackAmountMinusFees the amount being paid back minus fees
    * @param _originationFeeRepaid the fee on the amount that is being repaid
    * @param _balanceIncrease the accrued interest on the borrowed amount
    * @param _repaidWholeLoan true if the user is repaying the whole loan
    **/

    function updateStateOnRepay(
        address _reserve,
        address _user,
        uint256 _paybackAmountMinusFees,
        uint256 _originationFeeRepaid,
        uint256 _balanceIncrease,
        bool _repaidWholeLoan
    ) external onlyLendingPool {
        updateReserveStateOnRepayInternal(
            _reserve,
            _user,
            _paybackAmountMinusFees,
            _balanceIncrease
        );
        updateUserStateOnRepayInternal(
            _reserve,
            _user,
            _paybackAmountMinusFees,
            _originationFeeRepaid,
            _balanceIncrease,
            _repaidWholeLoan
        );

        updateReserveInterestRatesAndTimestampInternal(_reserve, _paybackAmountMinusFees, 0);
    }

    /**
    * @dev updates the state of the core as a consequence of a swap rate action.
    * @param _reserve the address of the reserve on which the user is repaying
    * @param _user the address of the borrower
    * @param _principalBorrowBalance the amount borrowed by the user
    * @param _compoundedBorrowBalance the amount borrowed plus accrued interest
    * @param _balanceIncrease the accrued interest on the borrowed amount
    * @param _currentRateMode the current interest rate mode for the user
    **/
    function updateStateOnSwapRate(
        address _reserve,
        address _user,
        uint256 _principalBorrowBalance,
        uint256 _compoundedBorrowBalance,
        uint256 _balanceIncrease,
        CoreLibrary.InterestRateMode _currentRateMode
    ) external onlyLendingPool returns (CoreLibrary.InterestRateMode, uint256) {
        updateReserveStateOnSwapRateInternal(
            _reserve,
            _user,
            _principalBorrowBalance,
            _compoundedBorrowBalance,
            _currentRateMode
        );

        CoreLibrary.InterestRateMode newRateMode = updateUserStateOnSwapRateInternal(
            _reserve,
            _user,
            _balanceIncrease,
            _currentRateMode
        );

        updateReserveInterestRatesAndTimestampInternal(_reserve, 0, 0);

        return (newRateMode, getUserCurrentBorrowRate(_reserve, _user));
    }

    /**
    * @dev updates the state of the core as a consequence of a liquidation action.
    * @param _principalReserve the address of the principal reserve that is being repaid
    * @param _collateralReserve the address of the collateral reserve that is being liquidated
    * @param _user the address of the borrower
    * @param _amountToLiquidate the amount being repaid by the liquidator
    * @param _collateralToLiquidate the amount of collateral being liquidated
    * @param _feeLiquidated the amount of origination fee being liquidated
    * @param _liquidatedCollateralForFee the amount of collateral equivalent to the origination fee + bonus
    * @param _balanceIncrease the accrued interest on the borrowed amount
    * @param _liquidatorReceivesAToken true if the liquidator will receive aTokens, false otherwise
    **/
    function updateStateOnLiquidation(
        address _principalReserve,
        address _collateralReserve,
        address _user,
        uint256 _amountToLiquidate,
        uint256 _collateralToLiquidate,
        uint256 _feeLiquidated,
        uint256 _liquidatedCollateralForFee,
        uint256 _balanceIncrease,
        bool _liquidatorReceivesAToken
    ) external onlyLendingPool {
        updatePrincipalReserveStateOnLiquidationInternal(
            _principalReserve,
            _user,
            _amountToLiquidate,
            _balanceIncrease
        );

        updateCollateralReserveStateOnLiquidationInternal(
            _collateralReserve
        );

        updateUserStateOnLiquidationInternal(
            _principalReserve,
            _user,
            _amountToLiquidate,
            _feeLiquidated,
            _balanceIncrease
        );

        updateReserveInterestRatesAndTimestampInternal(_principalReserve, _amountToLiquidate, 0);

        if (!_liquidatorReceivesAToken) {
            updateReserveInterestRatesAndTimestampInternal(
                _collateralReserve,
                0,
                _collateralToLiquidate.add(_liquidatedCollateralForFee)
            );
        }

    }

    /**
    * @dev updates the state of the core as a consequence of a stable rate rebalance
    * @param _reserve the address of the principal reserve where the user borrowed
    * @param _user the address of the borrower
    * @param _balanceIncrease the accrued interest on the borrowed amount
    * @return the new stable rate for the user
    **/
    function updateStateOnRebalance(address _reserve, address _user, uint256 _balanceIncrease)
    external
    onlyLendingPool
    returns (uint256)
    {
        updateReserveStateOnRebalanceInternal(_reserve, _user, _balanceIncrease);

        //update user data and rebalance the rate
        updateUserStateOnRebalanceInternal(_reserve, _user, _balanceIncrease);
        updateReserveInterestRatesAndTimestampInternal(_reserve, 0, 0);
        return usersReserveData[_user][_reserve].stableBorrowRate;
    }

    /**
    * @dev enables or disables a reserve as collateral
    * @param _reserve the address of the principal reserve where the user deposited
    * @param _user the address of the depositor
    * @param _useAsCollateral true if the depositor wants to use the reserve as collateral
    **/
    function setUserUseReserveAsCollateral(address _reserve, address _user, bool _useAsCollateral)
    public
    onlyLendingPool
    {
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];
        user.useAsCollateral = _useAsCollateral;
    }

    /**
    * @notice ETH/token transfer functions
    **/

    /**
    * @dev fallback function enforces that the caller is a contract, to support flashloan transfers
    **/
    function() external payable {
        //only contracts can send ETH to the core
        require(msg.sender.isContract(), "Only contracts can send ether to the Lending pool core");

    }

    /**
    * @dev transfers to the user a specific amount from the reserve.
    * @param _reserve the address of the reserve where the transfer is happening
    * @param _user the address of the user receiving the transfer
    * @param _amount the amount being transferred
    **/
    function transferToUser(address _reserve, address payable _user, uint256 _amount)
    external
    onlyLendingPool
    {
        if (_reserve != EthAddressLib.ethAddress()) {
            ERC20(_reserve).safeTransfer(_user, _amount);
        } else {
            //solium-disable-next-line
            (bool result, ) = _user.call.value(_amount).gas(50000)("");
            require(result, "Transfer of ETH failed");
        }
    }

    /**
    * @dev transfers the protocol fees to the fees collection address
    * @param _token the address of the token being transferred
    * @param _user the address of the user from where the transfer is happening
    * @param _amount the amount being transferred
    * @param _destination the fee receiver address
    **/

    function transferToFeeCollectionAddress(
        address _token,
        address _user,
        uint256 _amount,
        address _destination
    ) external payable onlyLendingPool {
        address payable feeAddress = address(uint160(_destination)); //cast the address to payable

        if (_token != EthAddressLib.ethAddress()) {
            require(
                msg.value == 0,
                "User is sending ETH along with the ERC20 transfer. Check the value attribute of the transaction"
            );
            ERC20(_token).safeTransferFrom(_user, feeAddress, _amount);
        } else {
            require(msg.value >= _amount, "The amount and the value sent to deposit do not match");
            //solium-disable-next-line
            (bool result, ) = feeAddress.call.value(_amount).gas(50000)("");
            require(result, "Transfer of ETH failed");
        }
    }

    /**
    * @dev transfers the fees to the fees collection address in the case of liquidation
    * @param _token the address of the token being transferred
    * @param _amount the amount being transferred
    * @param _destination the fee receiver address
    **/
    function liquidateFee(
        address _token,
        uint256 _amount,
        address _destination
    ) external payable onlyLendingPool {
        address payable feeAddress = address(uint160(_destination)); //cast the address to payable
        require(
            msg.value == 0,
            "Fee liquidation does not require any transfer of value"
        );

        if (_token != EthAddressLib.ethAddress()) {
            ERC20(_token).safeTransfer(feeAddress, _amount);
        } else {
            //solium-disable-next-line
            (bool result, ) = feeAddress.call.value(_amount).gas(50000)("");
            require(result, "Transfer of ETH failed");
        }
    }

    /**
    * @dev transfers an amount from a user to the destination reserve
    * @param _reserve the address of the reserve where the amount is being transferred
    * @param _user the address of the user from where the transfer is happening
    * @param _amount the amount being transferred
    **/
    function transferToReserve(address _reserve, address payable _user, uint256 _amount)
    external
    payable
    onlyLendingPool
    {
        if (_reserve != EthAddressLib.ethAddress()) {
            require(msg.value == 0, "User is sending ETH along with the ERC20 transfer.");
            ERC20(_reserve).safeTransferFrom(_user, address(this), _amount);

        } else {
            require(msg.value >= _amount, "The amount and the value sent to deposit do not match");

            if (msg.value > _amount) {
                //send back excess ETH
                uint256 excessAmount = msg.value.sub(_amount);
                //solium-disable-next-line
                (bool result, ) = _user.call.value(excessAmount).gas(50000)("");
                require(result, "Transfer of ETH failed");
            }
        }
    }

    /**
    * @notice data access functions
    **/

    /**
    * @dev returns the basic data (balances, fee accrued, reserve enabled/disabled as collateral)
    * needed to calculate the global account data in the LendingPoolDataProvider
    * @param _reserve the address of the reserve
    * @param _user the address of the user
    * @return the user deposited balance, the principal borrow balance, the fee, and if the reserve is enabled as collateral or not
    **/
    function getUserBasicReserveData(address _reserve, address _user)
    external
    view
    returns (uint256, uint256, uint256, bool)
    {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];

        uint256 underlyingBalance = getUserUnderlyingAssetBalance(_reserve, _user);

        if (user.principalBorrowBalance == 0) {
            return (underlyingBalance, 0, 0, user.useAsCollateral);
        }

        return (
        underlyingBalance,
        user.getCompoundedBorrowBalance(reserve),
        user.originationFee,
        user.useAsCollateral
        );
    }

    /**
    * @dev checks if a user is allowed to borrow at a stable rate
    * @param _reserve the reserve address
    * @param _user the user
    * @param _amount the amount the the user wants to borrow
    * @return true if the user is allowed to borrow at a stable rate, false otherwise
    **/

    function isUserAllowedToBorrowAtStable(address _reserve, address _user, uint256 _amount)
    external
    view
    returns (bool)
    {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];

        if (!reserve.isStableBorrowRateEnabled) return false;

        return
        !user.useAsCollateral ||
        !reserve.usageAsCollateralEnabled ||
        _amount > getUserUnderlyingAssetBalance(_reserve, _user);
    }

    /**
    * @dev gets the underlying asset balance of a user based on the corresponding aToken balance.
    * @param _reserve the reserve address
    * @param _user the user address
    * @return the underlying deposit balance of the user
    **/

    function getUserUnderlyingAssetBalance(address _reserve, address _user)
    public
    view
    returns (uint256)
    {
        AToken aToken = AToken(reserves[_reserve].aTokenAddress);
        return aToken.balanceOf(_user);

    }

    /**
    * @dev gets the interest rate strategy contract address for the reserve
    * @param _reserve the reserve address
    * @return the address of the interest rate strategy contract
    **/
    function getReserveInterestRateStrategyAddress(address _reserve) public view returns (address) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.interestRateStrategyAddress;
    }

    /**
    * @dev gets the aToken contract address for the reserve
    * @param _reserve the reserve address
    * @return the address of the aToken contract
    **/

    function getReserveATokenAddress(address _reserve) public view returns (address) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.aTokenAddress;
    }

    /**
    * @dev gets the available liquidity in the reserve. The available liquidity is the balance of the core contract
    * @param _reserve the reserve address
    * @return the available liquidity
    **/
    function getReserveAvailableLiquidity(address _reserve) public view returns (uint256) {
        uint256 balance = 0;

        if (_reserve == EthAddressLib.ethAddress()) {
            balance = address(this).balance;
        } else {
            balance = IERC20(_reserve).balanceOf(address(this));
        }
        return balance;
    }

    /**
    * @dev gets the total liquidity in the reserve. The total liquidity is the balance of the core contract + total borrows
    * @param _reserve the reserve address
    * @return the total liquidity
    **/
    function getReserveTotalLiquidity(address _reserve) public view returns (uint256) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return getReserveAvailableLiquidity(_reserve).add(reserve.getTotalBorrows());
    }

    /**
    * @dev gets the normalized income of the reserve. a value of 1e27 means there is no income. A value of 2e27 means there
    * there has been 100% income.
    * @param _reserve the reserve address
    * @return the reserve normalized income
    **/
    function getReserveNormalizedIncome(address _reserve) external view returns (uint256) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.getNormalizedIncome();
    }

    /**
    * @dev gets the reserve total borrows
    * @param _reserve the reserve address
    * @return the total borrows (stable + variable)
    **/
    function getReserveTotalBorrows(address _reserve) public view returns (uint256) {
        return reserves[_reserve].getTotalBorrows();
    }

    /**
    * @dev gets the reserve total borrows stable
    * @param _reserve the reserve address
    * @return the total borrows stable
    **/
    function getReserveTotalBorrowsStable(address _reserve) external view returns (uint256) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.totalBorrowsStable;
    }

    /**
    * @dev gets the reserve total borrows variable
    * @param _reserve the reserve address
    * @return the total borrows variable
    **/

    function getReserveTotalBorrowsVariable(address _reserve) external view returns (uint256) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.totalBorrowsVariable;
    }

    /**
    * @dev gets the reserve liquidation threshold
    * @param _reserve the reserve address
    * @return the reserve liquidation threshold
    **/

    function getReserveLiquidationThreshold(address _reserve) external view returns (uint256) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.liquidationThreshold;
    }

    /**
    * @dev gets the reserve liquidation bonus
    * @param _reserve the reserve address
    * @return the reserve liquidation bonus
    **/

    function getReserveLiquidationBonus(address _reserve) external view returns (uint256) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.liquidationBonus;
    }

    /**
    * @dev gets the reserve current variable borrow rate. Is the base variable borrow rate if the reserve is empty
    * @param _reserve the reserve address
    * @return the reserve current variable borrow rate
    **/

    function getReserveCurrentVariableBorrowRate(address _reserve) external view returns (uint256) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];

        if (reserve.currentVariableBorrowRate == 0) {
            return
            IReserveInterestRateStrategy(reserve.interestRateStrategyAddress)
            .getBaseVariableBorrowRate();
        }
        return reserve.currentVariableBorrowRate;
    }

    /**
    * @dev gets the reserve current stable borrow rate. Is the market rate if the reserve is empty
    * @param _reserve the reserve address
    * @return the reserve current stable borrow rate
    **/

    function getReserveCurrentStableBorrowRate(address _reserve) public view returns (uint256) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        ILendingRateOracle oracle = ILendingRateOracle(addressesProvider.getLendingRateOracle());

        if (reserve.currentStableBorrowRate == 0) {
            //no stable rate borrows yet
            return oracle.getMarketBorrowRate(_reserve);
        }

        return reserve.currentStableBorrowRate;
    }

    /**
    * @dev gets the reserve average stable borrow rate. The average stable rate is the weighted average
    * of all the loans taken at stable rate.
    * @param _reserve the reserve address
    * @return the reserve current average borrow rate
    **/
    function getReserveCurrentAverageStableBorrowRate(address _reserve)
    external
    view
    returns (uint256)
    {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.currentAverageStableBorrowRate;
    }

    /**
    * @dev gets the reserve liquidity rate
    * @param _reserve the reserve address
    * @return the reserve liquidity rate
    **/
    function getReserveCurrentLiquidityRate(address _reserve) external view returns (uint256) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.currentLiquidityRate;
    }

    /**
    * @dev gets the reserve liquidity cumulative index
    * @param _reserve the reserve address
    * @return the reserve liquidity cumulative index
    **/
    function getReserveLiquidityCumulativeIndex(address _reserve) external view returns (uint256) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.lastLiquidityCumulativeIndex;
    }

    /**
    * @dev gets the reserve variable borrow index
    * @param _reserve the reserve address
    * @return the reserve variable borrow index
    **/
    function getReserveVariableBorrowsCumulativeIndex(address _reserve)
    external
    view
    returns (uint256)
    {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.lastVariableBorrowCumulativeIndex;
    }

    /**
    * @dev this function aggregates the configuration parameters of the reserve.
    * It's used in the LendingPoolDataProvider specifically to save gas, and avoid
    * multiple external contract calls to fetch the same data.
    * @param _reserve the reserve address
    * @return the reserve decimals
    * @return the base ltv as collateral
    * @return the liquidation threshold
    * @return if the reserve is used as collateral or not
    **/
    function getReserveConfiguration(address _reserve)
    external
    view
    returns (uint256, uint256, uint256, bool)
    {
        uint256 decimals;
        uint256 baseLTVasCollateral;
        uint256 liquidationThreshold;
        bool usageAsCollateralEnabled;

        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        decimals = reserve.decimals;
        baseLTVasCollateral = reserve.baseLTVasCollateral;
        liquidationThreshold = reserve.liquidationThreshold;
        usageAsCollateralEnabled = reserve.usageAsCollateralEnabled;

        return (decimals, baseLTVasCollateral, liquidationThreshold, usageAsCollateralEnabled);
    }

    /**
    * @dev returns the decimals of the reserve
    * @param _reserve the reserve address
    * @return the reserve decimals
    **/
    function getReserveDecimals(address _reserve) external view returns (uint256) {
        return reserves[_reserve].decimals;
    }

    /**
    * @dev returns true if the reserve is enabled for borrowing
    * @param _reserve the reserve address
    * @return true if the reserve is enabled for borrowing, false otherwise
    **/

    function isReserveBorrowingEnabled(address _reserve) external view returns (bool) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.borrowingEnabled;
    }

    /**
    * @dev returns true if the reserve is enabled as collateral
    * @param _reserve the reserve address
    * @return true if the reserve is enabled as collateral, false otherwise
    **/

    function isReserveUsageAsCollateralEnabled(address _reserve) external view returns (bool) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.usageAsCollateralEnabled;
    }

    /**
    * @dev returns true if the stable rate is enabled on reserve
    * @param _reserve the reserve address
    * @return true if the stable rate is enabled on reserve, false otherwise
    **/
    function getReserveIsStableBorrowRateEnabled(address _reserve) external view returns (bool) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.isStableBorrowRateEnabled;
    }

    /**
    * @dev returns true if the reserve is active
    * @param _reserve the reserve address
    * @return true if the reserve is active, false otherwise
    **/
    function getReserveIsActive(address _reserve) external view returns (bool) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.isActive;
    }

    /**
    * @notice returns if a reserve is freezed
    * @param _reserve the reserve for which the information is needed
    * @return true if the reserve is freezed, false otherwise
    **/

    function getReserveIsFreezed(address _reserve) external view returns (bool) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        return reserve.isFreezed;
    }

    /**
    * @notice returns the timestamp of the last action on the reserve
    * @param _reserve the reserve for which the information is needed
    * @return the last updated timestamp of the reserve
    **/

    function getReserveLastUpdate(address _reserve) external view returns (uint40 timestamp) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        timestamp = reserve.lastUpdateTimestamp;
    }

    /**
    * @dev returns the utilization rate U of a specific reserve
    * @param _reserve the reserve for which the information is needed
    * @return the utilization rate in ray
    **/

    function getReserveUtilizationRate(address _reserve) public view returns (uint256) {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];

        uint256 totalBorrows = reserve.getTotalBorrows();

        if (totalBorrows == 0) {
            return 0;
        }

        uint256 availableLiquidity = getReserveAvailableLiquidity(_reserve);

        return totalBorrows.rayDiv(availableLiquidity.add(totalBorrows));
    }

    /**
    * @return the array of reserves configured on the core
    **/
    function getReserves() external view returns (address[] memory) {
        return reservesList;
    }

    /**
    * @param _reserve the address of the reserve for which the information is needed
    * @param _user the address of the user for which the information is needed
    * @return true if the user has chosen to use the reserve as collateral, false otherwise
    **/
    function isUserUseReserveAsCollateralEnabled(address _reserve, address _user)
    external
    view
    returns (bool)
    {
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];
        return user.useAsCollateral;
    }

    /**
    * @param _reserve the address of the reserve for which the information is needed
    * @param _user the address of the user for which the information is needed
    * @return the origination fee for the user
    **/
    function getUserOriginationFee(address _reserve, address _user)
    external
    view
    returns (uint256)
    {
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];
        return user.originationFee;
    }

    /**
    * @dev users with no loans in progress have NONE as borrow rate mode
    * @param _reserve the address of the reserve for which the information is needed
    * @param _user the address of the user for which the information is needed
    * @return the borrow rate mode for the user,
    **/

    function getUserCurrentBorrowRateMode(address _reserve, address _user)
    public
    view
    returns (CoreLibrary.InterestRateMode)
    {
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];

        if (user.principalBorrowBalance == 0) {
            return CoreLibrary.InterestRateMode.NONE;
        }

        return
        user.stableBorrowRate > 0
        ? CoreLibrary.InterestRateMode.STABLE
        : CoreLibrary.InterestRateMode.VARIABLE;
    }

    /**
    * @dev gets the current borrow rate of the user
    * @param _reserve the address of the reserve for which the information is needed
    * @param _user the address of the user for which the information is needed
    * @return the borrow rate for the user,
    **/
    function getUserCurrentBorrowRate(address _reserve, address _user)
    internal
    view
    returns (uint256)
    {
        CoreLibrary.InterestRateMode rateMode = getUserCurrentBorrowRateMode(_reserve, _user);

        if (rateMode == CoreLibrary.InterestRateMode.NONE) {
            return 0;
        }

        return
        rateMode == CoreLibrary.InterestRateMode.STABLE
        ? usersReserveData[_user][_reserve].stableBorrowRate
        : reserves[_reserve].currentVariableBorrowRate;
    }

    /**
    * @dev the stable rate returned is 0 if the user is borrowing at variable or not borrowing at all
    * @param _reserve the address of the reserve for which the information is needed
    * @param _user the address of the user for which the information is needed
    * @return the user stable rate
    **/
    function getUserCurrentStableBorrowRate(address _reserve, address _user)
    external
    view
    returns (uint256)
    {
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];
        return user.stableBorrowRate;
    }

    /**
    * @dev calculates and returns the borrow balances of the user
    * @param _reserve the address of the reserve
    * @param _user the address of the user
    * @return the principal borrow balance, the compounded balance and the balance increase since the last borrow/repay/swap/rebalance
    **/

    function getUserBorrowBalances(address _reserve, address _user)
    public
    view
    returns (uint256, uint256, uint256)
    {
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];
        if (user.principalBorrowBalance == 0) {
            return (0, 0, 0);
        }

        uint256 principal = user.principalBorrowBalance;
        uint256 compoundedBalance = CoreLibrary.getCompoundedBorrowBalance(
            user,
            reserves[_reserve]
        );
        return (principal, compoundedBalance, compoundedBalance.sub(principal));
    }

    /**
    * @dev the variable borrow index of the user is 0 if the user is not borrowing or borrowing at stable
    * @param _reserve the address of the reserve for which the information is needed
    * @param _user the address of the user for which the information is needed
    * @return the variable borrow index for the user
    **/

    function getUserVariableBorrowCumulativeIndex(address _reserve, address _user)
    external
    view
    returns (uint256)
    {
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];
        return user.lastVariableBorrowCumulativeIndex;
    }

    /**
    * @dev the variable borrow index of the user is 0 if the user is not borrowing or borrowing at stable
    * @param _reserve the address of the reserve for which the information is needed
    * @param _user the address of the user for which the information is needed
    * @return the variable borrow index for the user
    **/

    function getUserLastUpdate(address _reserve, address _user)
    external
    view
    returns (uint256 timestamp)
    {
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];
        timestamp = user.lastUpdateTimestamp;
    }

    /**
    * @dev updates the lending pool core configuration
    **/
    function refreshConfiguration() external onlyLendingPoolConfigurator {
        refreshConfigInternal();
    }

    /**
    * @dev initializes a reserve
    * @param _reserve the address of the reserve
    * @param _aTokenAddress the address of the overlying aToken contract
    * @param _decimals the decimals of the reserve currency
    * @param _interestRateStrategyAddress the address of the interest rate strategy contract
    **/
    function initReserve(
        address _reserve,
        address _aTokenAddress,
        uint256 _decimals,
        address _interestRateStrategyAddress
    ) external onlyLendingPoolConfigurator {
        reserves[_reserve].init(_aTokenAddress, _decimals, _interestRateStrategyAddress);
        addReserveToListInternal(_reserve);

    }



    /**
    * @dev removes the last added reserve in the reservesList array
    * @param _reserveToRemove the address of the reserve
    **/
    function removeLastAddedReserve(address _reserveToRemove)
    external onlyLendingPoolConfigurator {

        address lastReserve = reservesList[reservesList.length-1];

        require(lastReserve == _reserveToRemove, "Reserve being removed is different than the reserve requested");

        //as we can't check if totalLiquidity is 0 (since the reserve added might not be an ERC20) we at least check that there is nothing borrowed
        require(getReserveTotalBorrows(lastReserve) == 0, "Cannot remove a reserve with liquidity deposited");

        reserves[lastReserve].isActive = false;
        reserves[lastReserve].aTokenAddress = address(0);
        reserves[lastReserve].decimals = 0;
        reserves[lastReserve].lastLiquidityCumulativeIndex = 0;
        reserves[lastReserve].lastVariableBorrowCumulativeIndex = 0;
        reserves[lastReserve].borrowingEnabled = false;
        reserves[lastReserve].usageAsCollateralEnabled = false;
        reserves[lastReserve].baseLTVasCollateral = 0;
        reserves[lastReserve].liquidationThreshold = 0;
        reserves[lastReserve].liquidationBonus = 0;
        reserves[lastReserve].interestRateStrategyAddress = address(0);

        reservesList.pop();
    }

    /**
    * @dev updates the address of the interest rate strategy contract
    * @param _reserve the address of the reserve
    * @param _rateStrategyAddress the address of the interest rate strategy contract
    **/

    function setReserveInterestRateStrategyAddress(address _reserve, address _rateStrategyAddress)
    external
    onlyLendingPoolConfigurator
    {
        reserves[_reserve].interestRateStrategyAddress = _rateStrategyAddress;
    }

    /**
    * @dev enables borrowing on a reserve. Also sets the stable rate borrowing
    * @param _reserve the address of the reserve
    * @param _stableBorrowRateEnabled true if the stable rate needs to be enabled, false otherwise
    **/

    function enableBorrowingOnReserve(address _reserve, bool _stableBorrowRateEnabled)
    external
    onlyLendingPoolConfigurator
    {
        reserves[_reserve].enableBorrowing(_stableBorrowRateEnabled);
    }

    /**
    * @dev disables borrowing on a reserve
    * @param _reserve the address of the reserve
    **/

    function disableBorrowingOnReserve(address _reserve) external onlyLendingPoolConfigurator {
        reserves[_reserve].disableBorrowing();
    }

    /**
    * @dev enables a reserve to be used as collateral
    * @param _reserve the address of the reserve
    **/
    function enableReserveAsCollateral(
        address _reserve,
        uint256 _baseLTVasCollateral,
        uint256 _liquidationThreshold,
        uint256 _liquidationBonus
    ) external onlyLendingPoolConfigurator {
        reserves[_reserve].enableAsCollateral(
            _baseLTVasCollateral,
            _liquidationThreshold,
            _liquidationBonus
        );
    }

    /**
    * @dev disables a reserve to be used as collateral
    * @param _reserve the address of the reserve
    **/
    function disableReserveAsCollateral(address _reserve) external onlyLendingPoolConfigurator {
        reserves[_reserve].disableAsCollateral();
    }

    /**
    * @dev enable the stable borrow rate mode on a reserve
    * @param _reserve the address of the reserve
    **/
    function enableReserveStableBorrowRate(address _reserve) external onlyLendingPoolConfigurator {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        reserve.isStableBorrowRateEnabled = true;
    }

    /**
    * @dev disable the stable borrow rate mode on a reserve
    * @param _reserve the address of the reserve
    **/
    function disableReserveStableBorrowRate(address _reserve) external onlyLendingPoolConfigurator {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        reserve.isStableBorrowRateEnabled = false;
    }

    /**
    * @dev activates a reserve
    * @param _reserve the address of the reserve
    **/
    function activateReserve(address _reserve) external onlyLendingPoolConfigurator {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];

        require(
            reserve.lastLiquidityCumulativeIndex > 0 &&
            reserve.lastVariableBorrowCumulativeIndex > 0,
            "Reserve has not been initialized yet"
        );
        reserve.isActive = true;
    }

    /**
    * @dev deactivates a reserve
    * @param _reserve the address of the reserve
    **/
    function deactivateReserve(address _reserve) external onlyLendingPoolConfigurator {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        reserve.isActive = false;
    }

    /**
    * @notice allows the configurator to freeze the reserve.
    * A freezed reserve does not allow any action apart from repay, redeem, liquidationCall, rebalance.
    * @param _reserve the address of the reserve
    **/
    function freezeReserve(address _reserve) external onlyLendingPoolConfigurator {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        reserve.isFreezed = true;
    }

    /**
    * @notice allows the configurator to unfreeze the reserve. A unfreezed reserve allows any action to be executed.
    * @param _reserve the address of the reserve
    **/
    function unfreezeReserve(address _reserve) external onlyLendingPoolConfigurator {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        reserve.isFreezed = false;
    }

    /**
    * @notice allows the configurator to update the loan to value of a reserve
    * @param _reserve the address of the reserve
    * @param _ltv the new loan to value
    **/
    function setReserveBaseLTVasCollateral(address _reserve, uint256 _ltv)
    external
    onlyLendingPoolConfigurator
    {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        reserve.baseLTVasCollateral = _ltv;
    }

    /**
    * @notice allows the configurator to update the liquidation threshold of a reserve
    * @param _reserve the address of the reserve
    * @param _threshold the new liquidation threshold
    **/
    function setReserveLiquidationThreshold(address _reserve, uint256 _threshold)
    external
    onlyLendingPoolConfigurator
    {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        reserve.liquidationThreshold = _threshold;
    }

    /**
    * @notice allows the configurator to update the liquidation bonus of a reserve
    * @param _reserve the address of the reserve
    * @param _bonus the new liquidation bonus
    **/
    function setReserveLiquidationBonus(address _reserve, uint256 _bonus)
    external
    onlyLendingPoolConfigurator
    {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        reserve.liquidationBonus = _bonus;
    }

    /**
    * @notice allows the configurator to update the reserve decimals
    * @param _reserve the address of the reserve
    * @param _decimals the decimals of the reserve
    **/
    function setReserveDecimals(address _reserve, uint256 _decimals)
    external
    onlyLendingPoolConfigurator
    {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        reserve.decimals = _decimals;
    }

    /**
    * @notice internal functions
    **/

    /**
    * @dev updates the state of a reserve as a consequence of a borrow action.
    * @param _reserve the address of the reserve on which the user is borrowing
    * @param _user the address of the borrower
    * @param _principalBorrowBalance the previous borrow balance of the borrower before the action
    * @param _balanceIncrease the accrued interest of the user on the previous borrowed amount
    * @param _amountBorrowed the new amount borrowed
    * @param _rateMode the borrow rate mode (stable, variable)
    **/

    function updateReserveStateOnBorrowInternal(
        address _reserve,
        address _user,
        uint256 _principalBorrowBalance,
        uint256 _balanceIncrease,
        uint256 _amountBorrowed,
        CoreLibrary.InterestRateMode _rateMode
    ) internal {
        reserves[_reserve].updateCumulativeIndexes();

        //increasing reserve total borrows to account for the new borrow balance of the user
        //NOTE: Depending on the previous borrow mode, the borrows might need to be switched from variable to stable or vice versa

        updateReserveTotalBorrowsByRateModeInternal(
            _reserve,
            _user,
            _principalBorrowBalance,
            _balanceIncrease,
            _amountBorrowed,
            _rateMode
        );
    }

    /**
    * @dev updates the state of a user as a consequence of a borrow action.
    * @param _reserve the address of the reserve on which the user is borrowing
    * @param _user the address of the borrower
    * @param _amountBorrowed the amount borrowed
    * @param _balanceIncrease the accrued interest of the user on the previous borrowed amount
    * @param _rateMode the borrow rate mode (stable, variable)
    * @return the final borrow rate for the user. Emitted by the borrow() event
    **/

    function updateUserStateOnBorrowInternal(
        address _reserve,
        address _user,
        uint256 _amountBorrowed,
        uint256 _balanceIncrease,
        uint256 _fee,
        CoreLibrary.InterestRateMode _rateMode
    ) internal {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];

        if (_rateMode == CoreLibrary.InterestRateMode.STABLE) {
            //stable
            //reset the user variable index, and update the stable rate
            user.stableBorrowRate = reserve.currentStableBorrowRate;
            user.lastVariableBorrowCumulativeIndex = 0;
        } else if (_rateMode == CoreLibrary.InterestRateMode.VARIABLE) {
            //variable
            //reset the user stable rate, and store the new borrow index
            user.stableBorrowRate = 0;
            user.lastVariableBorrowCumulativeIndex = reserve.lastVariableBorrowCumulativeIndex;
        } else {
            revert("Invalid borrow rate mode");
        }
        //increase the principal borrows and the origination fee
        user.principalBorrowBalance = user.principalBorrowBalance.add(_amountBorrowed).add(
            _balanceIncrease
        );
        user.originationFee = user.originationFee.add(_fee);

        //solium-disable-next-line
        user.lastUpdateTimestamp = uint40(block.timestamp);

    }

    /**
    * @dev updates the state of the reserve as a consequence of a repay action.
    * @param _reserve the address of the reserve on which the user is repaying
    * @param _user the address of the borrower
    * @param _paybackAmountMinusFees the amount being paid back minus fees
    * @param _balanceIncrease the accrued interest on the borrowed amount
    **/

    function updateReserveStateOnRepayInternal(
        address _reserve,
        address _user,
        uint256 _paybackAmountMinusFees,
        uint256 _balanceIncrease
    ) internal {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        CoreLibrary.UserReserveData storage user = usersReserveData[_reserve][_user];

        CoreLibrary.InterestRateMode borrowRateMode = getUserCurrentBorrowRateMode(_reserve, _user);

        //update the indexes
        reserves[_reserve].updateCumulativeIndexes();

        //compound the cumulated interest to the borrow balance and then subtracting the payback amount
        if (borrowRateMode == CoreLibrary.InterestRateMode.STABLE) {
            reserve.increaseTotalBorrowsStableAndUpdateAverageRate(
                _balanceIncrease,
                user.stableBorrowRate
            );
            reserve.decreaseTotalBorrowsStableAndUpdateAverageRate(
                _paybackAmountMinusFees,
                user.stableBorrowRate
            );
        } else {
            reserve.increaseTotalBorrowsVariable(_balanceIncrease);
            reserve.decreaseTotalBorrowsVariable(_paybackAmountMinusFees);
        }
    }

    /**
    * @dev updates the state of the user as a consequence of a repay action.
    * @param _reserve the address of the reserve on which the user is repaying
    * @param _user the address of the borrower
    * @param _paybackAmountMinusFees the amount being paid back minus fees
    * @param _originationFeeRepaid the fee on the amount that is being repaid
    * @param _balanceIncrease the accrued interest on the borrowed amount
    * @param _repaidWholeLoan true if the user is repaying the whole loan
    **/
    function updateUserStateOnRepayInternal(
        address _reserve,
        address _user,
        uint256 _paybackAmountMinusFees,
        uint256 _originationFeeRepaid,
        uint256 _balanceIncrease,
        bool _repaidWholeLoan
    ) internal {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];

        //update the user principal borrow balance, adding the cumulated interest and then subtracting the payback amount
        user.principalBorrowBalance = user.principalBorrowBalance.add(_balanceIncrease).sub(
            _paybackAmountMinusFees
        );
        user.lastVariableBorrowCumulativeIndex = reserve.lastVariableBorrowCumulativeIndex;

        //if the balance decrease is equal to the previous principal (user is repaying the whole loan)
        //and the rate mode is stable, we reset the interest rate mode of the user
        if (_repaidWholeLoan) {
            user.stableBorrowRate = 0;
            user.lastVariableBorrowCumulativeIndex = 0;
        }
        user.originationFee = user.originationFee.sub(_originationFeeRepaid);

        //solium-disable-next-line
        user.lastUpdateTimestamp = uint40(block.timestamp);

    }

    /**
    * @dev updates the state of the user as a consequence of a swap rate action.
    * @param _reserve the address of the reserve on which the user is performing the rate swap
    * @param _user the address of the borrower
    * @param _principalBorrowBalance the the principal amount borrowed by the user
    * @param _compoundedBorrowBalance the principal amount plus the accrued interest
    * @param _currentRateMode the rate mode at which the user borrowed
    **/
    function updateReserveStateOnSwapRateInternal(
        address _reserve,
        address _user,
        uint256 _principalBorrowBalance,
        uint256 _compoundedBorrowBalance,
        CoreLibrary.InterestRateMode _currentRateMode
    ) internal {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];

        //compounding reserve indexes
        reserve.updateCumulativeIndexes();

        if (_currentRateMode == CoreLibrary.InterestRateMode.STABLE) {
            uint256 userCurrentStableRate = user.stableBorrowRate;

            //swap to variable
            reserve.decreaseTotalBorrowsStableAndUpdateAverageRate(
                _principalBorrowBalance,
                userCurrentStableRate
            ); //decreasing stable from old principal balance
            reserve.increaseTotalBorrowsVariable(_compoundedBorrowBalance); //increase variable borrows
        } else if (_currentRateMode == CoreLibrary.InterestRateMode.VARIABLE) {
            //swap to stable
            uint256 currentStableRate = reserve.currentStableBorrowRate;
            reserve.decreaseTotalBorrowsVariable(_principalBorrowBalance);
            reserve.increaseTotalBorrowsStableAndUpdateAverageRate(
                _compoundedBorrowBalance,
                currentStableRate
            );

        } else {
            revert("Invalid rate mode received");
        }
    }

    /**
    * @dev updates the state of the user as a consequence of a swap rate action.
    * @param _reserve the address of the reserve on which the user is performing the swap
    * @param _user the address of the borrower
    * @param _balanceIncrease the accrued interest on the borrowed amount
    * @param _currentRateMode the current rate mode of the user
    **/

    function updateUserStateOnSwapRateInternal(
        address _reserve,
        address _user,
        uint256 _balanceIncrease,
        CoreLibrary.InterestRateMode _currentRateMode
    ) internal returns (CoreLibrary.InterestRateMode) {
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];

        CoreLibrary.InterestRateMode newMode = CoreLibrary.InterestRateMode.NONE;

        if (_currentRateMode == CoreLibrary.InterestRateMode.VARIABLE) {
            //switch to stable
            newMode = CoreLibrary.InterestRateMode.STABLE;
            user.stableBorrowRate = reserve.currentStableBorrowRate;
            user.lastVariableBorrowCumulativeIndex = 0;
        } else if (_currentRateMode == CoreLibrary.InterestRateMode.STABLE) {
            newMode = CoreLibrary.InterestRateMode.VARIABLE;
            user.stableBorrowRate = 0;
            user.lastVariableBorrowCumulativeIndex = reserve.lastVariableBorrowCumulativeIndex;
        } else {
            revert("Invalid interest rate mode received");
        }
        //compounding cumulated interest
        user.principalBorrowBalance = user.principalBorrowBalance.add(_balanceIncrease);
        //solium-disable-next-line
        user.lastUpdateTimestamp = uint40(block.timestamp);

        return newMode;
    }

    /**
    * @dev updates the state of the principal reserve as a consequence of a liquidation action.
    * @param _principalReserve the address of the principal reserve that is being repaid
    * @param _user the address of the borrower
    * @param _amountToLiquidate the amount being repaid by the liquidator
    * @param _balanceIncrease the accrued interest on the borrowed amount
    **/

    function updatePrincipalReserveStateOnLiquidationInternal(
        address _principalReserve,
        address _user,
        uint256 _amountToLiquidate,
        uint256 _balanceIncrease
    ) internal {
        CoreLibrary.ReserveData storage reserve = reserves[_principalReserve];
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_principalReserve];

        //update principal reserve data
        reserve.updateCumulativeIndexes();

        CoreLibrary.InterestRateMode borrowRateMode = getUserCurrentBorrowRateMode(
            _principalReserve,
            _user
        );

        if (borrowRateMode == CoreLibrary.InterestRateMode.STABLE) {
            //increase the total borrows by the compounded interest
            reserve.increaseTotalBorrowsStableAndUpdateAverageRate(
                _balanceIncrease,
                user.stableBorrowRate
            );

            //decrease by the actual amount to liquidate
            reserve.decreaseTotalBorrowsStableAndUpdateAverageRate(
                _amountToLiquidate,
                user.stableBorrowRate
            );

        } else {
            //increase the total borrows by the compounded interest
            reserve.increaseTotalBorrowsVariable(_balanceIncrease);

            //decrease by the actual amount to liquidate
            reserve.decreaseTotalBorrowsVariable(_amountToLiquidate);
        }

    }

    /**
    * @dev updates the state of the collateral reserve as a consequence of a liquidation action.
    * @param _collateralReserve the address of the collateral reserve that is being liquidated
    **/
    function updateCollateralReserveStateOnLiquidationInternal(
        address _collateralReserve
    ) internal {
        //update collateral reserve
        reserves[_collateralReserve].updateCumulativeIndexes();

    }

    /**
    * @dev updates the state of the user being liquidated as a consequence of a liquidation action.
    * @param _reserve the address of the principal reserve that is being repaid
    * @param _user the address of the borrower
    * @param _amountToLiquidate the amount being repaid by the liquidator
    * @param _feeLiquidated the amount of origination fee being liquidated
    * @param _balanceIncrease the accrued interest on the borrowed amount
    **/
    function updateUserStateOnLiquidationInternal(
        address _reserve,
        address _user,
        uint256 _amountToLiquidate,
        uint256 _feeLiquidated,
        uint256 _balanceIncrease
    ) internal {
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        //first increase by the compounded interest, then decrease by the liquidated amount
        user.principalBorrowBalance = user.principalBorrowBalance.add(_balanceIncrease).sub(
            _amountToLiquidate
        );

        if (
            getUserCurrentBorrowRateMode(_reserve, _user) == CoreLibrary.InterestRateMode.VARIABLE
        ) {
            user.lastVariableBorrowCumulativeIndex = reserve.lastVariableBorrowCumulativeIndex;
        }

        if(_feeLiquidated > 0){
            user.originationFee = user.originationFee.sub(_feeLiquidated);
        }

        //solium-disable-next-line
        user.lastUpdateTimestamp = uint40(block.timestamp);
    }

    /**
    * @dev updates the state of the reserve as a consequence of a stable rate rebalance
    * @param _reserve the address of the principal reserve where the user borrowed
    * @param _user the address of the borrower
    * @param _balanceIncrease the accrued interest on the borrowed amount
    **/

    function updateReserveStateOnRebalanceInternal(
        address _reserve,
        address _user,
        uint256 _balanceIncrease
    ) internal {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];

        reserve.updateCumulativeIndexes();

        reserve.increaseTotalBorrowsStableAndUpdateAverageRate(
            _balanceIncrease,
            user.stableBorrowRate
        );

    }

    /**
    * @dev updates the state of the user as a consequence of a stable rate rebalance
    * @param _reserve the address of the principal reserve where the user borrowed
    * @param _user the address of the borrower
    * @param _balanceIncrease the accrued interest on the borrowed amount
    **/

    function updateUserStateOnRebalanceInternal(
        address _reserve,
        address _user,
        uint256 _balanceIncrease
    ) internal {
        CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];

        user.principalBorrowBalance = user.principalBorrowBalance.add(_balanceIncrease);
        user.stableBorrowRate = reserve.currentStableBorrowRate;

        //solium-disable-next-line
        user.lastUpdateTimestamp = uint40(block.timestamp);
    }

    /**
    * @dev updates the state of the user as a consequence of a stable rate rebalance
    * @param _reserve the address of the principal reserve where the user borrowed
    * @param _user the address of the borrower
    * @param _balanceIncrease the accrued interest on the borrowed amount
    * @param _amountBorrowed the accrued interest on the borrowed amount
    **/
    function updateReserveTotalBorrowsByRateModeInternal(
        address _reserve,
        address _user,
        uint256 _principalBalance,
        uint256 _balanceIncrease,
        uint256 _amountBorrowed,
        CoreLibrary.InterestRateMode _newBorrowRateMode
    ) internal {
        CoreLibrary.InterestRateMode previousRateMode = getUserCurrentBorrowRateMode(
            _reserve,
            _user
        );
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];

        if (previousRateMode == CoreLibrary.InterestRateMode.STABLE) {
            CoreLibrary.UserReserveData storage user = usersReserveData[_user][_reserve];
            reserve.decreaseTotalBorrowsStableAndUpdateAverageRate(
                _principalBalance,
                user.stableBorrowRate
            );
        } else if (previousRateMode == CoreLibrary.InterestRateMode.VARIABLE) {
            reserve.decreaseTotalBorrowsVariable(_principalBalance);
        }

        uint256 newPrincipalAmount = _principalBalance.add(_balanceIncrease).add(_amountBorrowed);
        if (_newBorrowRateMode == CoreLibrary.InterestRateMode.STABLE) {
            reserve.increaseTotalBorrowsStableAndUpdateAverageRate(
                newPrincipalAmount,
                reserve.currentStableBorrowRate
            );
        } else if (_newBorrowRateMode == CoreLibrary.InterestRateMode.VARIABLE) {
            reserve.increaseTotalBorrowsVariable(newPrincipalAmount);
        } else {
            revert("Invalid new borrow rate mode");
        }
    }

    /**
    * @dev Updates the reserve current stable borrow rate Rf, the current variable borrow rate Rv and the current liquidity rate Rl.
    * Also updates the lastUpdateTimestamp value. Please refer to the whitepaper for further information.
    * @param _reserve the address of the reserve to be updated
    * @param _liquidityAdded the amount of liquidity added to the protocol (deposit or repay) in the previous action
    * @param _liquidityTaken the amount of liquidity taken from the protocol (redeem or borrow)
    **/

    function updateReserveInterestRatesAndTimestampInternal(
        address _reserve,
        uint256 _liquidityAdded,
        uint256 _liquidityTaken
    ) internal {
        CoreLibrary.ReserveData storage reserve = reserves[_reserve];
        (uint256 newLiquidityRate, uint256 newStableRate, uint256 newVariableRate) = IReserveInterestRateStrategy(
            reserve
            .interestRateStrategyAddress
        )
        .calculateInterestRates(
            _reserve,
            getReserveAvailableLiquidity(_reserve).add(_liquidityAdded).sub(_liquidityTaken),
            reserve.totalBorrowsStable,
            reserve.totalBorrowsVariable,
            reserve.currentAverageStableBorrowRate
        );

        reserve.currentLiquidityRate = newLiquidityRate;
        reserve.currentStableBorrowRate = newStableRate;
        reserve.currentVariableBorrowRate = newVariableRate;

        //solium-disable-next-line
        reserve.lastUpdateTimestamp = uint40(block.timestamp);

        emit ReserveUpdated(
            _reserve,
            newLiquidityRate,
            newStableRate,
            newVariableRate,
            reserve.lastLiquidityCumulativeIndex,
            reserve.lastVariableBorrowCumulativeIndex
        );
    }

    /**
    * @dev transfers to the protocol fees of a flashloan to the fees collection address
    * @param _token the address of the token being transferred
    * @param _amount the amount being transferred
    **/

    function transferFlashLoanProtocolFeeInternal(address _token, uint256 _amount) internal {
        address payable receiver = address(uint160(addressesProvider.getTokenDistributor()));

        if (_token != EthAddressLib.ethAddress()) {
            ERC20(_token).safeTransfer(receiver, _amount);
        } else {
            receiver.transfer(_amount);
        }
    }

    /**
    * @dev updates the internal configuration of the core
    **/
    function refreshConfigInternal() internal {
        lendingPoolAddress = addressesProvider.getLendingPool();
    }

    /**
    * @dev adds a reserve to the array of the reserves address
    **/
    function addReserveToListInternal(address _reserve) internal {
        bool reserveAlreadyAdded = false;
        for (uint256 i = 0; i < reservesList.length; i++)
            if (reservesList[i] == _reserve) {
                reserveAlreadyAdded = true;
            }
        if (!reserveAlreadyAdded) reservesList.push(_reserve);
    }

}
