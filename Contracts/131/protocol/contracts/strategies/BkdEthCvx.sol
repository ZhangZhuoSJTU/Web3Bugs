// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./ConvexStrategyBase.sol";
import "../../libraries/UncheckedMath.sol";

/**
 * This is the BkdEthCvx strategy, which is designed to be used by a Backd ETH Vault.
 * The strategy holds ETH as it's underlying and allocates liquidity to Convex via given Curve Pool with 2 underlying tokens.
 * Rewards received on Convex (CVX, CRV), are sold in part for the underlying.
 * A share of earned CVX & CRV are retained on behalf of the Backd community to participate in governance.
 */
contract BkdEthCvx is ConvexStrategyBase {
    using ScaledMath for uint256;
    using UncheckedMath for uint256;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using AddressProviderHelpers for IAddressProvider;

    constructor(
        address vault_,
        address strategist_,
        uint256 convexPid_,
        address curvePool_,
        uint256 curveIndex_,
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
        // Setting default values
        imbalanceToleranceIn = 0.0007e18;
        imbalanceToleranceOut = 0.025e18;

        // Approvals
        (address lp_, , , , , ) = _BOOSTER.poolInfo(convexPid_);
        IERC20(lp_).safeApprove(address(_BOOSTER), type(uint256).max);
    }

    receive() external payable {}

    function name() external pure override returns (string memory) {
        return "BkdEthCvx";
    }

    function balance() public view override returns (uint256) {
        return _underlyingBalance() + _lpToUnderlying(_stakedBalance() + _lpBalance());
    }

    function _deposit() internal override returns (bool) {
        // Depositing into Curve Pool
        uint256 underlyingBalance = _underlyingBalance();
        if (underlyingBalance == 0) return false;
        uint256[2] memory amounts;
        amounts[curveIndex] = underlyingBalance;
        curvePool.add_liquidity{value: underlyingBalance}(
            amounts,
            _minLpAccepted(underlyingBalance)
        );

        // Depositing into Convex and Staking
        if (!_BOOSTER.depositAll(convexPid, true)) return false;
        return true;
    }

    function _withdraw(uint256 amount) internal override returns (bool) {
        bool success;
        uint256 underlyingBalance = _underlyingBalance();

        // Transferring from idle balance if enough
        if (underlyingBalance >= amount) {
            // solhint-disable-next-line avoid-low-level-calls
            (success, ) = payable(vault).call{value: amount}("");
            require(success, Error.FAILED_TRANSFER);
            emit Withdraw(amount);
            return true;
        }

        // Unstaking needed LP Tokens from Convex
        uint256 requiredUnderlyingAmount = amount.uncheckedSub(underlyingBalance);
        uint256 maxLpBurned = _maxLpBurned(requiredUnderlyingAmount);
        uint256 requiredLpAmount = maxLpBurned - _lpBalance();
        if (!rewards.withdrawAndUnwrap(requiredLpAmount, false)) return false;

        // Removing needed liquidity from Curve
        uint256[2] memory amounts;
        // solhint-disable-next-line reentrancy
        amounts[curveIndex] = requiredUnderlyingAmount;
        curvePool.remove_liquidity_imbalance(amounts, maxLpBurned);
        // solhint-disable-next-line avoid-low-level-calls
        (success, ) = payable(vault).call{value: amount}("");
        require(success, Error.FAILED_TRANSFER);
        return true;
    }

    function _withdrawAll() internal override returns (uint256) {
        // Unstaking and withdrawing from Convex pool
        uint256 stakedBalance = _stakedBalance();
        if (stakedBalance > 0) {
            if (!rewards.withdrawAndUnwrap(stakedBalance, false)) return 0;
        }

        // Removing liquidity from Curve
        uint256 lpBalance = _lpBalance();
        if (lpBalance > 0) {
            curvePool.remove_liquidity_one_coin(
                lpBalance,
                int128(uint128(curveIndex)),
                _minUnderlyingAccepted(lpBalance)
            );
        }

        // Transferring underlying to vault
        uint256 underlyingBalance = _underlyingBalance();
        if (underlyingBalance == 0) return 0;
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = payable(vault).call{value: underlyingBalance}("");
        require(success, Error.FAILED_TRANSFER);
        return underlyingBalance;
    }

    function _underlyingBalance() internal view override returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Calculates the minimum LP to accept when depositing underlying into Curve Pool.
     * @param _underlyingAmount Amount of underlying that is being deposited into Curve Pool.
     * @return The minimum LP balance to accept.
     */
    function _minLpAccepted(uint256 _underlyingAmount) internal view returns (uint256) {
        return _underlyingToLp(_underlyingAmount).scaledMul(ScaledMath.ONE - imbalanceToleranceIn);
    }

    /**
     * @notice Calculates the maximum LP to accept burning when withdrawing amount from Curve Pool.
     * @param _underlyingAmount Amount of underlying that is being withdrawn from Curve Pool.
     * @return The maximum LP balance to accept burning.
     */
    function _maxLpBurned(uint256 _underlyingAmount) internal view returns (uint256) {
        return _underlyingToLp(_underlyingAmount).scaledMul(ScaledMath.ONE + imbalanceToleranceOut);
    }

    /**
     * @notice Calculates the minimum underlying to accept when burning LP tokens to withdraw from Curve Pool.
     * @param _lpAmount Amount of LP tokens being burned to withdraw from Curve Pool.
     * @return The minimum underlying balance to accept.
     */
    function _minUnderlyingAccepted(uint256 _lpAmount) internal view returns (uint256) {
        return _lpToUnderlying(_lpAmount).scaledMul(ScaledMath.ONE - imbalanceToleranceOut);
    }

    /**
     * @notice Converts an amount of underlying into their estimated LP value.
     * @dev Uses get_virtual_price which is less susceptible to manipulation.
     *  But is also less accurate to how much could be withdrawn.
     * @param _underlyingAmount Amount of underlying to convert.
     * @return The estimated value in the LP.
     */
    function _underlyingToLp(uint256 _underlyingAmount) internal view returns (uint256) {
        return _underlyingAmount.scaledDiv(curvePool.get_virtual_price());
    }

    /**
     * @notice Converts an amount of LP into their estimated underlying value.
     * @dev Uses get_virtual_price which is less susceptible to manipulation.
     *  But is also less accurate to how much could be withdrawn.
     * @param _lpAmount Amount of LP to convert.
     * @return The estimated value in the underlying.
     */
    function _lpToUnderlying(uint256 _lpAmount) internal view returns (uint256) {
        return _lpAmount.scaledMul(curvePool.get_virtual_price());
    }
}
