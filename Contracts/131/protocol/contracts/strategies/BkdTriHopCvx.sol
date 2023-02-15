// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./ConvexStrategyBase.sol";
import "../../interfaces/IERC20Full.sol";
import "../../interfaces/strategies/IBkdTriHopCvx.sol";
import "../../libraries/UncheckedMath.sol";

/**
 * This is the BkdTriHopCvx strategy, which is designed to be used by a Backd ERC20 Vault.
 * The strategy holds a given ERC20 underlying and allocates liquidity to Convex via a given Curve Pool.
 * The Curve Pools used are Meta Pools which first require getting an LP Token from another Curve Pool.
 * The strategy does a 'Hop' when depositing and withdrawing, by first getting the required LP Token, and then the final LP Token for Convex.
 * Rewards received on Convex (CVX, CRV), are sold in part for the underlying.
 * A share of earned CVX & CRV are retained on behalf of the Backd community to participate in governance.
 */
contract BkdTriHopCvx is ConvexStrategyBase, IBkdTriHopCvx {
    using ScaledMath for uint256;
    using UncheckedMath for uint256;
    using SafeERC20 for IERC20;

    ICurveSwapEth public immutable curveHopPool; // Curve Pool to use for Hops
    IERC20 public immutable hopLp; // Curve Hop Pool LP Token
    uint256 public immutable curveHopIndex; // Underlying index in Curve Pool

    uint256 public hopImbalanceToleranceIn; // Maximum allowed slippage from Curve Hop Pool Imbalance for depositing
    uint256 public hopImbalanceToleranceOut; // Maximum allowed slippage from Curve Hop Pool Imbalance for withdrawing
    uint256 public decimalMultiplier; // Used for converting between underlying and LP

    event SetHopImbalanceToleranceIn(uint256 value); // Emitted after a successful setting of hop imbalance tolerance in
    event SetHopImbalanceToleranceOut(uint256 value); // Emitted after a successful setting of hop imbalance tolerance out

    constructor(
        address vault_,
        address strategist_,
        uint256 convexPid_,
        address curvePool_,
        uint256 curveIndex_,
        address curveHopPool_,
        uint256 curveHopIndex_,
        IAddressProvider addressProvider_
    )
        ConvexStrategyBase(
            vault_,
            strategist_,
            convexPid_,
            curvePool_,
            curveIndex_,
            addressProvider_
        )
    {
        // Getting data from supporting contracts
        _validateCurvePool(curveHopPool_);
        (address lp_, , , , , ) = _BOOSTER.poolInfo(convexPid_);
        address hopLp_ = ICurveSwapEth(curvePool_).coins(curveIndex_);
        hopLp = IERC20(hopLp_);
        curveHopPool = ICurveSwapEth(curveHopPool_);
        address underlying_ = ICurveSwapEth(curveHopPool_).coins(curveHopIndex_);
        underlying = IERC20(underlying_);
        decimalMultiplier = 10**(18 - IERC20Full(underlying_).decimals());

        // Setting inputs
        curveHopIndex = curveHopIndex_;

        // Setting default values
        imbalanceToleranceIn = 0.001e18;
        imbalanceToleranceOut = 0.048e18;
        hopImbalanceToleranceIn = 0.001e18;
        hopImbalanceToleranceOut = 0.0015e18;

        // Approvals
        IERC20(underlying_).safeApprove(curveHopPool_, type(uint256).max);
        IERC20(hopLp_).safeApprove(curvePool_, type(uint256).max);
        IERC20(lp_).safeApprove(address(_BOOSTER), type(uint256).max);
    }

    /**
     * @notice Set hop imbalance tolerance for Curve Hop Pool deposits.
     * @dev Stored as a percent, e.g. 1% would be set as 0.01
     * @param _hopImbalanceToleranceIn New hop imbalance tolerance in.
     * @return True if successfully set.
     */
    function setHopImbalanceToleranceIn(uint256 _hopImbalanceToleranceIn)
        external
        override
        onlyGovernance
        returns (bool)
    {
        hopImbalanceToleranceIn = _hopImbalanceToleranceIn;
        emit SetHopImbalanceToleranceIn(_hopImbalanceToleranceIn);
        return true;
    }

    /**
     * @notice Set hop imbalance tolerance for Curve Hop Pool withdrawals.
     * @dev Stored as a percent, e.g. 1% would be set as 0.01
     * @param _hopImbalanceToleranceOut New hop imbalance tolerance out.
     * @return True if successfully set.
     */
    function setHopImbalanceToleranceOut(uint256 _hopImbalanceToleranceOut)
        external
        override
        onlyGovernance
        returns (bool)
    {
        hopImbalanceToleranceOut = _hopImbalanceToleranceOut;
        emit SetHopImbalanceToleranceOut(_hopImbalanceToleranceOut);
        return true;
    }

    /**
     * @notice Changes the Convex Pool used for farming yield, e.g. from FRAX to MIM.
     * @dev First withdraws all funds, then harvests any rewards, then changes pool, then deposits again.
     * @param convexPid_ The PID for the new Convex Pool.
     * @param curvePool_ The Curve Pool to deposit into to get the required LP Token for Convex staking.
     * @param curveIndex_ The index of the new Convex Pool Token in the new Curve Pool.
     */
    function changeConvexPool(
        uint256 convexPid_,
        address curvePool_,
        uint256 curveIndex_
    ) external override onlyGovernance {
        _validateCurvePool(curvePool_);
        _harvest();
        _withdrawAllToHopLp();
        convexPid = convexPid_;
        curveIndex = curveIndex_;
        (address lp_, , , address rewards_, , ) = _BOOSTER.poolInfo(convexPid_);
        lp = IERC20(lp_);
        rewards = IRewardStaking(rewards_);
        curvePool = ICurveSwapEth(curvePool_);
        IERC20(hopLp).safeApprove(curvePool_, 0);
        IERC20(hopLp).safeApprove(curvePool_, type(uint256).max);
        IERC20(lp_).safeApprove(address(_BOOSTER), 0);
        IERC20(lp_).safeApprove(address(_BOOSTER), type(uint256).max);
        require(_deposit(), Error.DEPOSIT_FAILED);
    }

    function balance() public view override returns (uint256) {
        return
            _underlyingBalance() +
            _hopLpToUnderlying(_lpToHopLp(_stakedBalance() + _lpBalance()) + _hopLpBalance());
    }

    function name() public pure override returns (string memory) {
        return "BkdTriHopCvx";
    }

    function _deposit() internal override returns (bool) {
        require(msg.value == 0, Error.INVALID_VALUE);

        // Depositing into Curve Hop Pool
        uint256 underlyingBalance = _underlyingBalance();
        if (underlyingBalance > 0) {
            uint256[3] memory hopAmounts;
            hopAmounts[curveHopIndex] = underlyingBalance;
            curveHopPool.add_liquidity(hopAmounts, _minHopLpAcceptedFromDeposit(underlyingBalance));
        }

        // Depositing into Curve Pool
        uint256 hopLpBalance = _hopLpBalance();
        if (hopLpBalance > 0) {
            uint256[2] memory amounts;
            amounts[curveIndex] = hopLpBalance;
            curvePool.add_liquidity(amounts, _minLpAccepted(hopLpBalance));
        }

        // Depositing into Convex and Staking
        if (_lpBalance() == 0) return false;
        if (!_BOOSTER.depositAll(convexPid, true)) return false;
        return true;
    }

    function _withdraw(uint256 amount) internal override returns (bool) {
        // Transferring from idle balance if enough
        uint256 underlyingBalance = _underlyingBalance();
        if (underlyingBalance >= amount) {
            underlying.safeTransfer(vault, amount);
            emit Withdraw(amount);
            return true;
        }

        // Calculating needed amount of LP to withdraw
        uint256 requiredUnderlyingAmount = amount.uncheckedSub(underlyingBalance);
        uint256 maxHopLpBurned = _maxHopLpBurned(requiredUnderlyingAmount);
        uint256 requiredHopLpAmount = maxHopLpBurned - _hopLpBalance();
        uint256 maxLpBurned = _maxLpBurned(requiredHopLpAmount);
        uint256 requiredLpAmount = maxLpBurned - _lpBalance();

        // Unstaking needed LP Tokens from Convex
        if (!rewards.withdrawAndUnwrap(requiredLpAmount, false)) return false;

        // Removing needed liquidity from Curve Pool
        uint256[2] memory amounts;
        amounts[curveIndex] = requiredHopLpAmount;
        curvePool.remove_liquidity_imbalance(amounts, maxLpBurned);

        // Removing needed liquidity from Curve Hop Pool
        uint256[3] memory hopAmounts;
        hopAmounts[curveHopIndex] = requiredUnderlyingAmount;
        curveHopPool.remove_liquidity_imbalance(hopAmounts, maxHopLpBurned);

        // Sending underlying to vault
        underlying.safeTransfer(vault, amount);
        return true;
    }

    function _withdrawAll() internal override returns (uint256) {
        // Withdrawing all from Convex and converting to Hop LP Token
        _withdrawAllToHopLp();

        // Removing liquidity from Curve Hop Pool
        uint256 hopLpBalance = _hopLpBalance();
        if (hopLpBalance > 0) {
            curveHopPool.remove_liquidity_one_coin(
                hopLpBalance,
                int128(uint128(curveHopIndex)),
                _minUnderlyingAccepted(hopLpBalance)
            );
        }

        // Transferring underlying to vault
        uint256 underlyingBalance = _underlyingBalance();
        if (underlyingBalance == 0) return 0;
        underlying.safeTransfer(vault, underlyingBalance);
        return underlyingBalance;
    }

    function _underlyingBalance() internal view override returns (uint256) {
        return underlying.balanceOf(address(this));
    }

    /**
     * @dev Get the balance of the hop lp.
     */
    function _hopLpBalance() internal view returns (uint256) {
        return hopLp.balanceOf(address(this));
    }

    /**
     * @notice Calculates the minimum LP to accept when depositing underlying into Curve Pool.
     * @param _hopLpAmount Amount of Hop LP that is being deposited into Curve Pool.
     * @return The minimum LP balance to accept.
     */
    function _minLpAccepted(uint256 _hopLpAmount) internal view returns (uint256) {
        return _hopLpToLp(_hopLpAmount).scaledMul(ScaledMath.ONE - imbalanceToleranceIn);
    }

    /**
     * @notice Calculates the maximum LP to accept burning when withdrawing amount from Curve Pool.
     * @param _hopLpAmount Amount of Hop LP that is being withdrawn from Curve Pool.
     * @return The maximum LP balance to accept burning.
     */
    function _maxLpBurned(uint256 _hopLpAmount) internal view returns (uint256) {
        return _hopLpToLp(_hopLpAmount).scaledMul(ScaledMath.ONE + imbalanceToleranceOut);
    }

    /**
     * @notice Calculates the minimum Hop LP to accept when burning LP tokens to withdraw from Curve Pool.
     * @param _lpAmount Amount of LP tokens being burned to withdraw from Curve Pool.
     * @return The minimum Hop LP balance to accept.
     */
    function _minHopLpAcceptedFromWithdraw(uint256 _lpAmount) internal view returns (uint256) {
        return _lpToHopLp(_lpAmount).scaledMul(ScaledMath.ONE - imbalanceToleranceOut);
    }

    /**
     * @notice Calculates the minimum Hop LP to accept when depositing underlying into Curve Hop Pool.
     * @param _underlyingAmount Amount of underlying that is being deposited into Curve Hop Pool.
     * @return The minimum Hop LP balance to accept.
     */
    function _minHopLpAcceptedFromDeposit(uint256 _underlyingAmount)
        internal
        view
        returns (uint256)
    {
        return
            _underlyingToHopLp(_underlyingAmount).scaledMul(
                ScaledMath.ONE - hopImbalanceToleranceIn
            );
    }

    /**
     * @notice Calculates the maximum Hop LP to accept burning when withdrawing amount from Curve Hop Pool.
     * @param _underlyingAmount Amount of underlying that is being withdrawn from Curve Hop Pool.
     * @return The maximum Hop LP balance to accept burning.
     */
    function _maxHopLpBurned(uint256 _underlyingAmount) internal view returns (uint256) {
        return
            _underlyingToHopLp(_underlyingAmount).scaledMul(
                ScaledMath.ONE + hopImbalanceToleranceOut
            );
    }

    /**
     * @notice Calculates the minimum underlying to accept when burning Hop LP tokens to withdraw from Curve Hop Pool.
     * @param _hopLpAmount Amount of Hop LP tokens being burned to withdraw from Curve Hop Pool.
     * @return The minimum underlying balance to accept.
     */
    function _minUnderlyingAccepted(uint256 _hopLpAmount) internal view returns (uint256) {
        return
            _hopLpToUnderlying(_hopLpAmount).scaledMul(ScaledMath.ONE - hopImbalanceToleranceOut);
    }

    /**
     * @notice Converts an amount of underlying into their estimated Hop LP value.
     * @dev Uses get_virtual_price which is less susceptible to manipulation.
     *  But is also less accurate to how much could be withdrawn.
     * @param _underlyingAmount Amount of underlying to convert.
     * @return The estimated value in the Hop LP.
     */
    function _underlyingToHopLp(uint256 _underlyingAmount) internal view returns (uint256) {
        return (_underlyingAmount * decimalMultiplier).scaledDiv(curveHopPool.get_virtual_price());
    }

    /**
     * @notice Converts an amount of Hop LP into their estimated underlying value.
     * @dev Uses get_virtual_price which is less susceptible to manipulation.
     *  But is also less accurate to how much could be withdrawn.
     * @param _hopLpAmount Amount of Hop LP to convert.
     * @return The estimated value in the underlying.
     */
    function _hopLpToUnderlying(uint256 _hopLpAmount) internal view returns (uint256) {
        return (_hopLpAmount / decimalMultiplier).scaledMul(curveHopPool.get_virtual_price());
    }

    /**
     * @notice Converts an amount of LP into their estimated Hop LP value.
     * @dev Uses get_virtual_price which is less susceptible to manipulation.
     *  But is also less accurate to how much could be withdrawn.
     * @param _lpAmount Amount of underlying to convert.
     * @return The estimated value in the Hop LP.
     */
    function _lpToHopLp(uint256 _lpAmount) internal view returns (uint256) {
        return
            _lpAmount.scaledMul(curvePool.get_virtual_price()).scaledDiv(
                curveHopPool.get_virtual_price()
            );
    }

    /**
     * @notice Converts an amount of Hop LP into their estimated LP value.
     * @dev Uses get_virtual_price which is less susceptible to manipulation.
     *  But is also less accurate to how much could be withdrawn.
     * @param _hopLpAmount Amount of Hop LP to convert.
     * @return The estimated value in the LP.
     */
    function _hopLpToLp(uint256 _hopLpAmount) internal view returns (uint256) {
        return
            _hopLpAmount.scaledMul(curveHopPool.get_virtual_price()).scaledDiv(
                curvePool.get_virtual_price()
            );
    }

    /**
     * @dev Withdraw all underlying and convert to the Hop LP Token.
     */
    function _withdrawAllToHopLp() private {
        // Unstaking and withdrawing from Convex pool
        uint256 stakedBalance = _stakedBalance();
        if (stakedBalance > 0) {
            rewards.withdrawAndUnwrap(stakedBalance, false);
        }

        // Removing liquidity from Curve Pool
        uint256 lpBalance = _lpBalance();
        if (lpBalance > 0) {
            curvePool.remove_liquidity_one_coin(
                lpBalance,
                int128(uint128(curveIndex)),
                _minHopLpAcceptedFromWithdraw(lpBalance)
            );
        }
    }
}
