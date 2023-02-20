pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./WadRayMath.sol";

/**
* @title CoreLibrary library
* @author Aave
* @notice Defines the data structures of the reserves and the user data
**/
library CoreLibrary {
    using SafeMath for uint256;
    using WadRayMath for uint256;

    enum InterestRateMode {NONE, STABLE, VARIABLE}

    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    struct UserReserveData {
        //principal amount borrowed by the user.
        uint256 principalBorrowBalance;
        //cumulated variable borrow index for the user. Expressed in ray
        uint256 lastVariableBorrowCumulativeIndex;
        //origination fee cumulated by the user
        uint256 originationFee;
        // stable borrow rate at which the user has borrowed. Expressed in ray
        uint256 stableBorrowRate;
        uint40 lastUpdateTimestamp;
        //defines if a specific deposit should or not be used as a collateral in borrows
        bool useAsCollateral;
    }

    struct ReserveData {
        /**
        * @dev refer to the whitepaper, section 1.1 basic concepts for a formal description of these properties.
        **/
        //the liquidity index. Expressed in ray
        uint256 lastLiquidityCumulativeIndex;
        //the current supply rate. Expressed in ray
        uint256 currentLiquidityRate;
        //the total borrows of the reserve at a stable rate. Expressed in the currency decimals
        uint256 totalBorrowsStable;
        //the total borrows of the reserve at a variable rate. Expressed in the currency decimals
        uint256 totalBorrowsVariable;
        //the current variable borrow rate. Expressed in ray
        uint256 currentVariableBorrowRate;
        //the current stable borrow rate. Expressed in ray
        uint256 currentStableBorrowRate;
        //the current average stable borrow rate (weighted average of all the different stable rate loans). Expressed in ray
        uint256 currentAverageStableBorrowRate;
        //variable borrow index. Expressed in ray
        uint256 lastVariableBorrowCumulativeIndex;
        //the ltv of the reserve. Expressed in percentage (0-100)
        uint256 baseLTVasCollateral;
        //the liquidation threshold of the reserve. Expressed in percentage (0-100)
        uint256 liquidationThreshold;
        //the liquidation bonus of the reserve. Expressed in percentage
        uint256 liquidationBonus;
        //the decimals of the reserve asset
        uint256 decimals;
        /**
        * @dev address of the aToken representing the asset
        **/
        address aTokenAddress;
        /**
        * @dev address of the interest rate strategy contract
        **/
        address interestRateStrategyAddress;
        uint40 lastUpdateTimestamp;
        // borrowingEnabled = true means users can borrow from this reserve
        bool borrowingEnabled;
        // usageAsCollateralEnabled = true means users can use this reserve as collateral
        bool usageAsCollateralEnabled;
        // isStableBorrowRateEnabled = true means users can borrow at a stable rate
        bool isStableBorrowRateEnabled;
        // isActive = true means the reserve has been activated and properly configured
        bool isActive;
        // isFreezed = true means the reserve only allows repays and redeems, but not deposits, new borrowings or rate swap
        bool isFreezed;
    }

    /**
    * @dev returns the ongoing normalized income for the reserve.
    * a value of 1e27 means there is no income. As time passes, the income is accrued.
    * A value of 2*1e27 means that the income of the reserve is double the initial amount.
    * @param _reserve the reserve object
    * @return the normalized income. expressed in ray
    **/
    function getNormalizedIncome(CoreLibrary.ReserveData storage _reserve)
    internal
    view
    returns (uint256)
    {
        uint256 cumulated = calculateLinearInterest(
            _reserve
            .currentLiquidityRate,
            _reserve
            .lastUpdateTimestamp
        )
        .rayMul(_reserve.lastLiquidityCumulativeIndex);

        return cumulated;

    }

    /**
    * @dev Updates the liquidity cumulative index Ci and variable borrow cumulative index Bvc. Refer to the whitepaper for
    * a formal specification.
    * @param _self the reserve object
    **/
    function updateCumulativeIndexes(ReserveData storage _self) internal {
        uint256 totalBorrows = getTotalBorrows(_self);

        if (totalBorrows > 0) {
            //only cumulating if there is any income being produced
            uint256 cumulatedLiquidityInterest = calculateLinearInterest(
                _self.currentLiquidityRate,
                _self.lastUpdateTimestamp
            );

            _self.lastLiquidityCumulativeIndex = cumulatedLiquidityInterest.rayMul(
                _self.lastLiquidityCumulativeIndex
            );

            uint256 cumulatedVariableBorrowInterest = calculateCompoundedInterest(
                _self.currentVariableBorrowRate,
                _self.lastUpdateTimestamp
            );
            _self.lastVariableBorrowCumulativeIndex = cumulatedVariableBorrowInterest.rayMul(
                _self.lastVariableBorrowCumulativeIndex
            );
        }
    }

    /**
    * @dev accumulates a predefined amount of asset to the reserve as a fixed, one time income. Used for example to accumulate
    * the flashloan fee to the reserve, and spread it through the depositors.
    * @param _self the reserve object
    * @param _totalLiquidity the total liquidity available in the reserve
    * @param _amount the amount to accomulate
    **/
    function cumulateToLiquidityIndex(
        ReserveData storage _self,
        uint256 _totalLiquidity,
        uint256 _amount
    ) internal {
        uint256 amountToLiquidityRatio = _amount.wadToRay().rayDiv(_totalLiquidity.wadToRay());

        uint256 cumulatedLiquidity = amountToLiquidityRatio.add(WadRayMath.ray());

        _self.lastLiquidityCumulativeIndex = cumulatedLiquidity.rayMul(
            _self.lastLiquidityCumulativeIndex
        );
    }

    /**
    * @dev initializes a reserve
    * @param _self the reserve object
    * @param _aTokenAddress the address of the overlying atoken contract
    * @param _decimals the number of decimals of the underlying asset
    * @param _interestRateStrategyAddress the address of the interest rate strategy contract
    **/
    function init(
        ReserveData storage _self,
        address _aTokenAddress,
        uint256 _decimals,
        address _interestRateStrategyAddress
    ) external {
        require(_self.aTokenAddress == address(0), "Reserve has already been initialized");

        if (_self.lastLiquidityCumulativeIndex == 0) {
            //if the reserve has not been initialized yet
            _self.lastLiquidityCumulativeIndex = WadRayMath.ray();
        }

        if (_self.lastVariableBorrowCumulativeIndex == 0) {
            _self.lastVariableBorrowCumulativeIndex = WadRayMath.ray();
        }

        _self.aTokenAddress = _aTokenAddress;
        _self.decimals = _decimals;

        _self.interestRateStrategyAddress = _interestRateStrategyAddress;
        _self.isActive = true;
        _self.isFreezed = false;

    }

    /**
    * @dev enables borrowing on a reserve
    * @param _self the reserve object
    * @param _stableBorrowRateEnabled true if the stable borrow rate must be enabled by default, false otherwise
    **/
    function enableBorrowing(ReserveData storage _self, bool _stableBorrowRateEnabled) external {
        require(_self.borrowingEnabled == false, "Reserve is already enabled");

        _self.borrowingEnabled = true;
        _self.isStableBorrowRateEnabled = _stableBorrowRateEnabled;

    }

    /**
    * @dev disables borrowing on a reserve
    * @param _self the reserve object
    **/
    function disableBorrowing(ReserveData storage _self) external {
        _self.borrowingEnabled = false;
    }

    /**
    * @dev enables a reserve to be used as collateral
    * @param _self the reserve object
    * @param _baseLTVasCollateral the loan to value of the asset when used as collateral
    * @param _liquidationThreshold the threshold at which loans using this asset as collateral will be considered undercollateralized
    * @param _liquidationBonus the bonus liquidators receive to liquidate this asset
    **/
    function enableAsCollateral(
        ReserveData storage _self,
        uint256 _baseLTVasCollateral,
        uint256 _liquidationThreshold,
        uint256 _liquidationBonus
    ) external {
        require(
            _self.usageAsCollateralEnabled == false,
            "Reserve is already enabled as collateral"
        );

        _self.usageAsCollateralEnabled = true;
        _self.baseLTVasCollateral = _baseLTVasCollateral;
        _self.liquidationThreshold = _liquidationThreshold;
        _self.liquidationBonus = _liquidationBonus;

        if (_self.lastLiquidityCumulativeIndex == 0)
            _self.lastLiquidityCumulativeIndex = WadRayMath.ray();

    }

    /**
    * @dev disables a reserve as collateral
    * @param _self the reserve object
    **/
    function disableAsCollateral(ReserveData storage _self) external {
        _self.usageAsCollateralEnabled = false;
    }



    /**
    * @dev calculates the compounded borrow balance of a user
    * @param _self the userReserve object
    * @param _reserve the reserve object
    * @return the user compounded borrow balance
    **/
    function getCompoundedBorrowBalance(
        CoreLibrary.UserReserveData storage _self,
        CoreLibrary.ReserveData storage _reserve
    ) internal view returns (uint256) {
        if (_self.principalBorrowBalance == 0) return 0;

        uint256 principalBorrowBalanceRay = _self.principalBorrowBalance.wadToRay();
        uint256 compoundedBalance = 0;
        uint256 cumulatedInterest = 0;

        if (_self.stableBorrowRate > 0) {
            cumulatedInterest = calculateCompoundedInterest(
                _self.stableBorrowRate,
                _self.lastUpdateTimestamp
            );
        } else {
            //variable interest
            cumulatedInterest = calculateCompoundedInterest(
                _reserve
                .currentVariableBorrowRate,
                _reserve
                .lastUpdateTimestamp
            )
            .rayMul(_reserve.lastVariableBorrowCumulativeIndex)
            .rayDiv(_self.lastVariableBorrowCumulativeIndex);
        }

        compoundedBalance = principalBorrowBalanceRay.rayMul(cumulatedInterest).rayToWad();

        if (compoundedBalance == _self.principalBorrowBalance) {
            //solium-disable-next-line
            if (_self.lastUpdateTimestamp != block.timestamp) {
                //no interest cumulation because of the rounding - we add 1 wei
                //as symbolic cumulated interest to avoid interest free loans.

                return _self.principalBorrowBalance.add(1 wei);
            }
        }

        return compoundedBalance;
    }

    /**
    * @dev increases the total borrows at a stable rate on a specific reserve and updates the
    * average stable rate consequently
    * @param _reserve the reserve object
    * @param _amount the amount to add to the total borrows stable
    * @param _rate the rate at which the amount has been borrowed
    **/
    function increaseTotalBorrowsStableAndUpdateAverageRate(
        ReserveData storage _reserve,
        uint256 _amount,
        uint256 _rate
    ) internal {
        uint256 previousTotalBorrowStable = _reserve.totalBorrowsStable;
        //updating reserve borrows stable
        _reserve.totalBorrowsStable = _reserve.totalBorrowsStable.add(_amount);

        //update the average stable rate
        //weighted average of all the borrows
        uint256 weightedLastBorrow = _amount.wadToRay().rayMul(_rate);
        uint256 weightedPreviousTotalBorrows = previousTotalBorrowStable.wadToRay().rayMul(
            _reserve.currentAverageStableBorrowRate
        );

        _reserve.currentAverageStableBorrowRate = weightedLastBorrow
        .add(weightedPreviousTotalBorrows)
        .rayDiv(_reserve.totalBorrowsStable.wadToRay());
    }

    /**
    * @dev decreases the total borrows at a stable rate on a specific reserve and updates the
    * average stable rate consequently
    * @param _reserve the reserve object
    * @param _amount the amount to substract to the total borrows stable
    * @param _rate the rate at which the amount has been repaid
    **/
    function decreaseTotalBorrowsStableAndUpdateAverageRate(
        ReserveData storage _reserve,
        uint256 _amount,
        uint256 _rate
    ) internal {
        require(_reserve.totalBorrowsStable >= _amount, "Invalid amount to decrease");

        uint256 previousTotalBorrowStable = _reserve.totalBorrowsStable;

        //updating reserve borrows stable
        _reserve.totalBorrowsStable = _reserve.totalBorrowsStable.sub(_amount);

        if (_reserve.totalBorrowsStable == 0) {
            _reserve.currentAverageStableBorrowRate = 0; //no income if there are no stable rate borrows
            return;
        }

        //update the average stable rate
        //weighted average of all the borrows
        uint256 weightedLastBorrow = _amount.wadToRay().rayMul(_rate);
        uint256 weightedPreviousTotalBorrows = previousTotalBorrowStable.wadToRay().rayMul(
            _reserve.currentAverageStableBorrowRate
        );

        require(
            weightedPreviousTotalBorrows >= weightedLastBorrow,
            "The amounts to subtract don't match"
        );

        _reserve.currentAverageStableBorrowRate = weightedPreviousTotalBorrows
        .sub(weightedLastBorrow)
        .rayDiv(_reserve.totalBorrowsStable.wadToRay());
    }

    /**
    * @dev increases the total borrows at a variable rate
    * @param _reserve the reserve object
    * @param _amount the amount to add to the total borrows variable
    **/
    function increaseTotalBorrowsVariable(ReserveData storage _reserve, uint256 _amount) internal {
        _reserve.totalBorrowsVariable = _reserve.totalBorrowsVariable.add(_amount);
    }

    /**
    * @dev decreases the total borrows at a variable rate
    * @param _reserve the reserve object
    * @param _amount the amount to substract to the total borrows variable
    **/
    function decreaseTotalBorrowsVariable(ReserveData storage _reserve, uint256 _amount) internal {
        require(
            _reserve.totalBorrowsVariable >= _amount,
            "The amount that is being subtracted from the variable total borrows is incorrect"
        );
        _reserve.totalBorrowsVariable = _reserve.totalBorrowsVariable.sub(_amount);
    }

    /**
    * @dev function to calculate the interest using a linear interest rate formula
    * @param _rate the interest rate, in ray
    * @param _lastUpdateTimestamp the timestamp of the last update of the interest
    * @return the interest rate linearly accumulated during the timeDelta, in ray
    **/

    function calculateLinearInterest(uint256 _rate, uint40 _lastUpdateTimestamp)
    internal
    view
    returns (uint256)
    {
        //solium-disable-next-line
        uint256 timeDifference = block.timestamp.sub(uint256(_lastUpdateTimestamp));

        uint256 timeDelta = timeDifference.wadToRay().rayDiv(SECONDS_PER_YEAR.wadToRay());

        return _rate.rayMul(timeDelta).add(WadRayMath.ray());
    }

    /**
    * @dev function to calculate the interest using a compounded interest rate formula
    * @param _rate the interest rate, in ray
    * @param _lastUpdateTimestamp the timestamp of the last update of the interest
    * @return the interest rate compounded during the timeDelta, in ray
    **/
    function calculateCompoundedInterest(uint256 _rate, uint40 _lastUpdateTimestamp)
    internal
    view
    returns (uint256)
    {
        //solium-disable-next-line
        uint256 timeDifference = block.timestamp.sub(uint256(_lastUpdateTimestamp));

        uint256 ratePerSecond = _rate.div(SECONDS_PER_YEAR);

        return ratePerSecond.add(WadRayMath.ray()).rayPow(timeDifference);
    }

    /**
    * @dev returns the total borrows on the reserve
    * @param _reserve the reserve object
    * @return the total borrows (stable + variable)
    **/
    function getTotalBorrows(CoreLibrary.ReserveData storage _reserve)
    internal
    view
    returns (uint256)
    {
        return _reserve.totalBorrowsStable.add(_reserve.totalBorrowsVariable);
    }

}
