// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IPnL.sol";
import "../common/Controllable.sol";
import "../interfaces/IPnL.sol";
import "../common/Constants.sol";
import {FixedGTokens} from "../common/FixedContracts.sol";

/// @notice Contract for calculating protocol profit and loss. The PnL contract stores snapshots
///     of total assets in pwrd and gvt, which are used to calculate utilisation ratio and establish
///     changes in underling pwrd and gvt factors. The protocol will allow these values to drift as long
///     as they stay within a certain threshold of protocol actuals, or large amounts of assets are being
///     deposited or withdrawn from the protocol. The PnL contract ensures that any profits are distributed
///     between pwrd and gvt based on the utilisation ratio - as this ratio movese towards 1, a larger
///     amount of the pwrd profit is shifted to gvt. Protocol losses are on the other hand soaked up
///     by gvt, ensuring that pwrd never lose value.
///
///     ###############################################
///     PnL variables and calculations
///     ###############################################
///
///     yield - system gains and losses from assets invested into strategies are realised once
///         a harvest is run. Yield is ditributed to pwrd and gvt based on the utilisation ratio of the
///         two tokens (see _calcProfit).
///
///     PerformanceFee - The performance fee is deducted from any yield profits, and is used to
///         buy back and distribute governance tokens to users.
///
///     hodler Fee - Withdrawals experience a hodler fee that is socialized to all other holders.
///         Like other gains, this isn't realised on withdrawal, but rather when a critical amount
///         has amassed in the system (totalAssetsPercentThreshold).
///
///     ###############################################
///     PnL Actions
///     ###############################################
///
///     Pnl has two trigger mechanisms:
///         - Harvest:
///             - It will realize any loss/profit from the strategy
///             - It will atempt to update lastest cached curve stable coin dy
///                 - if successfull, it will try to realize any price changes (pre tvl vs current)
///         - Withdrawals
///             - Any user withdrawals are distributing the holder fee to the other users
contract PnL is Controllable, Constants, FixedGTokens, IPnL {
    using SafeMath for uint256;

    uint256 public override lastGvtAssets;
    uint256 public override lastPwrdAssets;
    bool public rebase = true;

    uint256 public performanceFee; // Amount of gains to use to buy back and distribute gov tokens

    event LogRebaseSwitch(bool status);
    event LogNewPerfromanceFee(uint256 fee);
    event LogNewGtokenChange(bool pwrd, int256 change);
    event LogPnLExecution(
        uint256 deductedAssets,
        int256 totalPnL,
        int256 investPnL,
        int256 pricePnL,
        uint256 withdrawalBonus,
        uint256 performanceBonus,
        uint256 beforeGvtAssets,
        uint256 beforePwrdAssets,
        uint256 afterGvtAssets,
        uint256 afterPwrdAssets
    );

    constructor(
        address pwrd,
        address gvt,
        uint256 pwrdAssets,
        uint256 gvtAssets
    ) public FixedGTokens(pwrd, gvt) {
        lastPwrdAssets = pwrdAssets;
        lastGvtAssets = gvtAssets;
    }

    /// @notice Turn pwrd rebasing on/off - This stops yield/ hodler bonuses to be distributed to the pwrd
    ///     token, which effectively stops it from rebasing any further.
    function setRebase(bool _rebase) external onlyOwner {
        rebase = _rebase;
        emit LogRebaseSwitch(_rebase);
    }

    /// @notice Fee taken from gains to be redistributed to users who stake their tokens
    /// @param _performanceFee Amount to remove from gains (%BP)
    function setPerformanceFee(uint256 _performanceFee) external onlyOwner {
        performanceFee = _performanceFee;
        emit LogNewPerfromanceFee(_performanceFee);
    }

    /// @notice Increase previously recorded GToken assets by specific amount
    /// @param pwrd pwrd/gvt
    /// @param dollarAmount Amount to increase by
    function increaseGTokenLastAmount(bool pwrd, uint256 dollarAmount) external override {
        require(msg.sender == controller, "increaseGTokenLastAmount: !controller");
        if (!pwrd) {
            lastGvtAssets = lastGvtAssets.add(dollarAmount);
        } else {
            lastPwrdAssets = lastPwrdAssets.add(dollarAmount);
        }
        emit LogNewGtokenChange(pwrd, int256(dollarAmount));
    }

    /// @notice Decrease previously recorded GToken assets by specific amount
    /// @param pwrd pwrd/gvt
    /// @param dollarAmount Amount to decrease by
    /// @param bonus hodler bonus
    function decreaseGTokenLastAmount(
        bool pwrd,
        uint256 dollarAmount,
        uint256 bonus
    ) external override {
        require(msg.sender == controller, "decreaseGTokenLastAmount: !controller");
        uint256 lastGA = lastGvtAssets;
        uint256 lastPA = lastPwrdAssets;
        if (!pwrd) {
            lastGA = dollarAmount > lastGA ? 0 : lastGA.sub(dollarAmount);
        } else {
            lastPA = dollarAmount > lastPA ? 0 : lastPA.sub(dollarAmount);
        }
        if (bonus > 0) {
            uint256 preGABeforeBonus = lastGA;
            uint256 prePABeforeBonus = lastPA;
            uint256 preTABeforeBonus = preGABeforeBonus.add(prePABeforeBonus);
            if (rebase) {
                lastGA = preGABeforeBonus.add(bonus.mul(preGABeforeBonus).div(preTABeforeBonus));
                lastPA = prePABeforeBonus.add(bonus.mul(prePABeforeBonus).div(preTABeforeBonus));
            } else {
                lastGA = preGABeforeBonus.add(bonus);
            }
            emit LogPnLExecution(0, int256(bonus), 0, 0, bonus, 0, preGABeforeBonus, prePABeforeBonus, lastGA, lastPA);
        }

        lastGvtAssets = lastGA;
        lastPwrdAssets = lastPA;
        emit LogNewGtokenChange(pwrd, int256(-dollarAmount));
    }

    /// @notice Return latest system asset states
    function calcPnL() external view override returns (uint256, uint256) {
        return (lastGvtAssets, lastPwrdAssets);
    }

    /// @notice Calculate utilisation ratio between gvt and pwrd
    function utilisationRatio() external view override returns (uint256) {
        return lastGvtAssets != 0 ? lastPwrdAssets.mul(PERCENTAGE_DECIMAL_FACTOR).div(lastGvtAssets) : 0;
    }

    /// @notice Update assets after entering emergency state
    function emergencyPnL() external override {
        require(msg.sender == controller, "emergencyPnL: !controller");
        forceDistribute();
    }

    /// @notice Recover system from emergency state
    function recover() external override {
        require(msg.sender == controller, "recover: !controller");
        forceDistribute();
    }

    /// @notice Distribute yield based on utilisation ratio
    /// @param gvtAssets Total gvt assets
    /// @param pwrdAssets Total pwrd assets
    /// @param profit Amount of profit to distribute
    /// @param reward Rewards contract
    function handleInvestGain(
        uint256 gvtAssets,
        uint256 pwrdAssets,
        uint256 profit,
        address reward
    )
        private
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 performanceBonus;
        if (performanceFee > 0 && reward != address(0)) {
            performanceBonus = profit.mul(performanceFee).div(PERCENTAGE_DECIMAL_FACTOR);
            profit = profit.sub(performanceBonus);
        }
        if (rebase) {
            uint256 totalAssets = gvtAssets.add(pwrdAssets);
            uint256 gvtProfit = profit.mul(gvtAssets).div(totalAssets);
            uint256 pwrdProfit = profit.mul(pwrdAssets).div(totalAssets);

            uint256 factor = pwrdAssets.mul(10000).div(gvtAssets);
            if (factor > 10000) factor = 10000;
            if (factor < 8000) {
                factor = factor.mul(3).div(8).add(3000);
            } else {
                factor = factor.sub(8000).mul(2).add(6000);
            }

            uint256 portionFromPwrdProfit = pwrdProfit.mul(factor).div(10000);
            gvtAssets = gvtAssets.add(gvtProfit.add(portionFromPwrdProfit));
            pwrdAssets = pwrdAssets.add(pwrdProfit.sub(portionFromPwrdProfit));
        } else {
            gvtAssets = gvtAssets.add(profit);
        }
        return (gvtAssets, pwrdAssets, performanceBonus);
    }

    /// @notice Distribute losses
    /// @param gvtAssets Total gvt assets
    /// @param pwrdAssets Total pwrd assets
    /// @param loss Amount of loss to distribute
    function handleLoss(
        uint256 gvtAssets,
        uint256 pwrdAssets,
        uint256 loss
    ) private pure returns (uint256, uint256) {
        uint256 maxGvtLoss = gvtAssets.sub(DEFAULT_DECIMALS_FACTOR);
        if (loss > maxGvtLoss) {
            gvtAssets = DEFAULT_DECIMALS_FACTOR;
            pwrdAssets = pwrdAssets.sub(loss.sub(maxGvtLoss));
        } else {
            gvtAssets = gvtAssets - loss;
        }
        return (gvtAssets, pwrdAssets);
    }

    function forceDistribute() private {
        uint256 total = _controller().totalAssets();

        if (total > lastPwrdAssets.add(DEFAULT_DECIMALS_FACTOR)) {
            lastGvtAssets = total - lastPwrdAssets;
        } else {
            lastGvtAssets = DEFAULT_DECIMALS_FACTOR;
            lastPwrdAssets = total.sub(DEFAULT_DECIMALS_FACTOR);
        }
    }

    function distributeStrategyGainLoss(
        uint256 gain,
        uint256 loss,
        address reward
    ) external override {
        require(msg.sender == controller, "!Controller");
        uint256 lastGA = lastGvtAssets;
        uint256 lastPA = lastPwrdAssets;
        uint256 performanceBonus;
        uint256 gvtAssets;
        uint256 pwrdAssets;
        int256 investPnL;
        if (gain > 0) {
            (gvtAssets, pwrdAssets, performanceBonus) = handleInvestGain(lastGA, lastPA, gain, reward);
            if (performanceBonus > 0) {
                gvt.mint(reward, gvt.factor(gvtAssets), performanceBonus);
                gvtAssets = gvtAssets.add(performanceBonus);
            }

            lastGvtAssets = gvtAssets;
            lastPwrdAssets = pwrdAssets;
            investPnL = int256(gain);
        } else if (loss > 0) {
            (lastGvtAssets, lastPwrdAssets) = handleLoss(lastGA, lastPA, loss);
            investPnL = -int256(loss);
        }

        emit LogPnLExecution(
            0,
            investPnL,
            investPnL,
            0,
            0,
            performanceBonus,
            lastGA,
            lastPA,
            lastGvtAssets,
            lastPwrdAssets
        );
    }

    function distributePriceChange(uint256 currentTotalAssets) external override {
        require(msg.sender == controller, "!Controller");
        uint256 gvtAssets = lastGvtAssets;
        uint256 pwrdAssets = lastPwrdAssets;
        uint256 totalAssets = gvtAssets.add(pwrdAssets);

        if (currentTotalAssets > totalAssets) {
            lastGvtAssets = gvtAssets.add(currentTotalAssets.sub(totalAssets));
        } else if (currentTotalAssets < totalAssets) {
            (lastGvtAssets, lastPwrdAssets) = handleLoss(gvtAssets, pwrdAssets, totalAssets.sub(currentTotalAssets));
        }
        int256 priceChange = int256(currentTotalAssets) - int256(totalAssets);

        emit LogPnLExecution(
            0,
            priceChange,
            0,
            priceChange,
            0,
            0,
            gvtAssets,
            pwrdAssets,
            lastGvtAssets,
            lastPwrdAssets
        );
    }
}
