// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../common/StructDefinitions.sol";
import "../common/Constants.sol";
import "../common/Controllable.sol";
import "../common/Whitelist.sol";
import "../interfaces/IERC20Detailed.sol";
import "../interfaces/IAllocation.sol";
import "../interfaces/ILifeGuard.sol";
import "../interfaces/IVault.sol";
import "../interfaces/IBuoy.sol";

/// @notice Contract for setting allocation targets for current protocol setup.
///     This contract will need to be upgraded if strategies in the protocol change.
///     --------------------------------------------------------
///     Current protocol setup:
///     --------------------------------------------------------
///     Stablecoins: DAI, USDC, USDT
///     LP tokens: 3Crv
///     Vaults: DAIVault, USDCVault, USDTVault, 3Crv vault
///     Strategy (exposures):
///         - Compound
///         - Idle finance
///         - Yearn Generic Lender:
///             - Cream
///         - CurveXpool:
///             - Curve3Pool
///             - CurveMetaPool
///             - Yearn
contract Allocation is Constants, Controllable, Whitelist, IAllocation {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Threshold used to make sure that small change in token value don't trigger rebalances
    uint256 public swapThreshold;
    // Threshold for determining if assets should be moved from the Curve vault
    uint256 public curvePercentThreshold;

    event LogNewSwapThreshold(uint256 threshold);
    event LogNewCurveThreshold(uint256 threshold);

    function setSwapThreshold(uint256 _swapThreshold) external onlyOwner {
        swapThreshold = _swapThreshold;
        emit LogNewSwapThreshold(_swapThreshold);
    }

    function setCurvePercentThreshold(uint256 _curvePercentThreshold) external onlyOwner {
        curvePercentThreshold = _curvePercentThreshold;
        emit LogNewCurveThreshold(_curvePercentThreshold);
    }

    /// @notice Calculate the difference between the protocol target allocations and
    ///     the actual protocol exposures (refered to as delta). This is used to determine
    ///     how the system needs to be rebalanced in the case that its getting close to being
    ///     overexposed.
    /// @param sysState Struct holding system state info
    /// @param expState Struct holding exposure state info
    function calcSystemTargetDelta(SystemState memory sysState, ExposureState memory expState)
        public
        view
        override
        returns (AllocationState memory allState)
    {
        // Strategy targets in stablecoin vaults are determined by the pwrd/gvt utilisationRatio
        allState.strategyTargetRatio = calcStrategyPercent(sysState.utilisationRatio);
        // Curve target is determined by governance (insurance - curveVaultPercent)
        allState.stableState = _calcVaultTargetDelta(sysState, false, true);
        // Calculate exposure delta - difference between targets and current assets
        (uint256 protocolExposedDeltaUsd, uint256 protocolExposedIndex) = calcProtocolExposureDelta(
            expState.protocolExposure,
            sysState
        );
        allState.protocolExposedIndex = protocolExposedIndex;
        if (protocolExposedDeltaUsd > allState.stableState.swapInTotalAmountUsd) {
            // If the rebalance cannot be achieved by simply moving assets from one vault, the
            // system needs to establish how to withdraw assets from all vaults and their
            // underlying strategies. Calculate protocol withdrawals based on all vaults,
            // each strategy above target withdraws: delta of current assets - target assets
            allState.needProtocolWithdrawal = true;
            allState.protocolWithdrawalUsd = calcProtocolWithdraw(allState, protocolExposedIndex);
        }
    }

    /// @notice Calculate the difference between target allocations for vault, and
    ///     actual exposures
    /// @param sysState Struct holding system state info
    /// @param onlySwapOut Calculation only for moving assets out of vault
    function calcVaultTargetDelta(SystemState memory sysState, bool onlySwapOut)
        public
        view
        override
        returns (StablecoinAllocationState memory)
    {
        return _calcVaultTargetDelta(sysState, onlySwapOut, false);
    }

    /// @notice Calculate how much assets should be moved out of strategies
    /// @param allState Struct holding system allocation info
    /// @param protocolExposedIndex Index of protocol for which exposures is being calculated
    /// @dev Protocol exposures are considered on their highest level - This means
    ///     that we can consider each strategy to have one exposure, even though they
    ///     might have several lower level exposures. For this to be true, the following
    ///     assumptions need to be true:
    ///     - Exposure overlap cannot occure among strategies:
    ///         - Strategies can't share protocol exposures. If two strategies are exposed
    ///             to Compound, the system level exposure to Compound may be higher than
    ///             the sum exposure of any individual strategy, e.g.:
    ///             Consider the following 2 strategies:
    ///                 - Strat A: Invest to protocol X
    ///                 - Strat B: Invest to protocol X and Y, through protocol Z
    ///             There is now a possibility that the total exposure to protocol X is higher
    ///             than the tolerated exposure level, and thus there would have to be
    ///             seperate logic to split out the exposure calculations in strat B
    ///             If on the other hand we have the following scenario:
    ///                 - Strat A: Invest to protocol X
    ///                 - Strat B: Invets to protocol Y, through protocol Z
    ///             We no longer need to consider the underlying exposures, but can rather look
    ///             at the total investment into the strategies as our current exposure
    ///     - Strategies in different vaults need to be ordered based on their exposure:
    ///         - To simplify the calculations, the order of strategies in vaults is important,
    ///             as the protocol exposures are addative for each strategy
    function calcProtocolWithdraw(AllocationState memory allState, uint256 protocolExposedIndex)
        private
        view
        returns (uint256[N_COINS] memory protocolWithdrawalUsd)
    {
        address[N_COINS] memory vaults = _controller().vaults();
        // How much to withdraw from each protocol
        uint256 strategyCurrentUsd;
        uint256 strategyTargetUsd;
        ILifeGuard lg = ILifeGuard(_controller().lifeGuard());
        IBuoy buoy = IBuoy(lg.getBuoy());
        // Loop over each vault
        for (uint256 i = 0; i < N_COINS; i++) {
            uint256 strategyAssets = IVault(vaults[i]).getStrategyAssets(protocolExposedIndex);
            // If the strategy has assets, determine the USD value of the asset
            if (strategyAssets > 0) {
                strategyCurrentUsd = buoy.singleStableToUsd(strategyAssets, i);
            }
            // Determine the USD value of the strategy asset target
            strategyTargetUsd = allState
            .stableState
            .vaultsTargetUsd[i]
            .mul(allState.strategyTargetRatio[protocolExposedIndex])
            .div(PERCENTAGE_DECIMAL_FACTOR);
            // If the strategy is over exposed, assets can be removed
            if (strategyCurrentUsd > strategyTargetUsd) {
                protocolWithdrawalUsd[i] = strategyCurrentUsd.sub(strategyTargetUsd);
            }
            // If the strategy is empty or under exposed, assets can be added
            if (protocolWithdrawalUsd[i] > 0 && protocolWithdrawalUsd[i] < allState.stableState.swapInAmountsUsd[i]) {
                protocolWithdrawalUsd[i] = allState.stableState.swapInAmountsUsd[i];
            }
        }
    }

    /// @notice Calculate how much assets should be moved in or out of vaults
    /// @param sysState Struct holding info about current system state
    /// @param onlySwapOut Do assets only need to be added to the vaults
    /// @param includeCurveVault Does the Curve vault need to considered in the rebalance
    function _calcVaultTargetDelta(
        SystemState memory sysState,
        bool onlySwapOut,
        bool includeCurveVault
    ) private view returns (StablecoinAllocationState memory stableState) {
        ILifeGuard lg = ILifeGuard(_controller().lifeGuard());
        IBuoy buoy = IBuoy(lg.getBuoy());

        uint256 amountToRebalance;
        // The rebalance may only be possible by moving assets out of the Curve vault,
        //  as Curve adds exposure to all stablecoins
        if (includeCurveVault && needCurveVault(sysState)) {
            stableState.curveTargetUsd = sysState.totalCurrentAssetsUsd.mul(sysState.curvePercent).div(
                PERCENTAGE_DECIMAL_FACTOR
            );
            // Estimate how much needs to be moved out of the Curve vault
            amountToRebalance = sysState.totalCurrentAssetsUsd.sub(stableState.curveTargetUsd);
            // When establishing current Curve exposures, we include uninvested assets in the lifeguard
            // as part of the Curve vault, otherwise I rebalance could temporarily fix an overexposure,
            // just to have to deal with the same overexposure when the lifeguard assets get invested
            // into the Curve vault.
            uint256 curveCurrentAssetsUsd = sysState.lifeguardCurrentAssetsUsd.add(sysState.curveCurrentAssetsUsd);
            stableState.curveTargetDeltaUsd = curveCurrentAssetsUsd > stableState.curveTargetUsd
                ? curveCurrentAssetsUsd.sub(stableState.curveTargetUsd)
                : 0;
        } else {
            // If we dont have to consider the Curve vault, Remove Curve assets and the part in lifeguard for Curve
            // from the rebalance calculations
            amountToRebalance = sysState
            .totalCurrentAssetsUsd
            .sub(sysState.curveCurrentAssetsUsd)
            .sub(sysState.lifeguardCurrentAssetsUsd)
            .add(lg.availableUsd());
        }

        // Calculate the strategy amount by vaultAssets * percentOfStrategy
        uint256 swapOutTotalUsd = 0;
        for (uint256 i = 0; i < N_COINS; i++) {
            // Compare allocation targets with actual assets in vault -
            //   if onlySwapOut = True, we don't consider the the current assets in the vault,
            //   but rather how much we need to remove from the vault based on target allocations.
            //   This means that the removal amount gets split throughout the vaults based on
            //   the allocation targets, rather than the difference between the allocation target
            //   and the actual amount of assets in the vault.
            uint256 vaultTargetUsd = amountToRebalance.mul(sysState.stablePercents[i]).div(PERCENTAGE_DECIMAL_FACTOR);
            uint256 vaultTargetAssets;
            if (!onlySwapOut) {
                vaultTargetAssets = vaultTargetUsd == 0 ? 0 : buoy.singleStableFromUsd(vaultTargetUsd, int128(i));
                stableState.vaultsTargetUsd[i] = vaultTargetUsd;
            }

            // More than target
            if (sysState.vaultCurrentAssetsUsd[i] > vaultTargetUsd) {
                if (!onlySwapOut) {
                    stableState.swapInAmounts[i] = sysState.vaultCurrentAssets[i].sub(vaultTargetAssets);
                    stableState.swapInAmountsUsd[i] = sysState.vaultCurrentAssetsUsd[i].sub(vaultTargetUsd);
                    // Make sure that that the change in vault asset is large enough to
                    // justify rebalancing the vault
                    if (invalidDelta(swapThreshold, stableState.swapInAmountsUsd[i])) {
                        stableState.swapInAmounts[i] = 0;
                        stableState.swapInAmountsUsd[i] = 0;
                    } else {
                        stableState.swapInTotalAmountUsd = stableState.swapInTotalAmountUsd.add(
                            stableState.swapInAmountsUsd[i]
                        );
                    }
                }
                // Less than target
            } else {
                stableState.swapOutPercents[i] = vaultTargetUsd.sub(sysState.vaultCurrentAssetsUsd[i]);
                // Make sure that that the change in vault asset is large enough to
                // justify rebalancing the vault
                if (invalidDelta(swapThreshold, stableState.swapOutPercents[i])) {
                    stableState.swapOutPercents[i] = 0;
                } else {
                    swapOutTotalUsd = swapOutTotalUsd.add(stableState.swapOutPercents[i]);
                }
            }
        }

        // Establish percentage (BP) amount for change in each vault
        uint256 percent = PERCENTAGE_DECIMAL_FACTOR;
        for (uint256 i = 0; i < N_COINS - 1; i++) {
            if (stableState.swapOutPercents[i] > 0) {
                stableState.swapOutPercents[i] = stableState.swapOutPercents[i].mul(PERCENTAGE_DECIMAL_FACTOR).div(
                    swapOutTotalUsd
                );
                percent = percent.sub(stableState.swapOutPercents[i]);
            }
        }
        stableState.swapOutPercents[N_COINS - 1] = percent;
    }

    /// @notice Calculate assets distribution to strategies
    /// @param utilisationRatio Ratio of gvt to pwrd
    /// @dev The distribution of assets between the primary and secondary
    ///     strategies are based on the pwrd/gvt utilisation ratio
    function calcStrategyPercent(uint256 utilisationRatio)
        public
        pure
        override
        returns (uint256[] memory targetPercent)
    {
        targetPercent = new uint256[](2);
        uint256 primaryTarget = PERCENTAGE_DECIMAL_FACTOR.mul(PERCENTAGE_DECIMAL_FACTOR).div(
            PERCENTAGE_DECIMAL_FACTOR.add(utilisationRatio)
        );

        targetPercent[0] = primaryTarget; // Primary
        targetPercent[1] = PERCENTAGE_DECIMAL_FACTOR // Secondary
        .sub(targetPercent[0]);
    }

    /// @notice Loops over the protocol exposures and calculate the delta between the exposure
    ///     and target threshold if the protocol is over exposed. For the Curve protocol, the delta is the
    ///     difference between the current exposure and target allocation.
    /// @param protocolExposure Exposure percent of protocols
    /// @param sysState Struct holding info of the systems current state
    /// @return protocolExposedDeltaUsd Difference between the overExposure and the target protocol exposure.
    ///     By defenition, only one protocol can exceed exposure in the current setup.
    /// @return protocolExposedIndex The index of the corresponding protocol of protocolDelta
    function calcProtocolExposureDelta(uint256[] memory protocolExposure, SystemState memory sysState)
        private
        pure
        returns (uint256 protocolExposedDeltaUsd, uint256 protocolExposedIndex)
    {
        for (uint256 i = 0; i < protocolExposure.length; i++) {
            // If the exposure is greater than the rebalance threshold...
            if (protocolExposedDeltaUsd == 0 && protocolExposure[i] > sysState.rebalanceThreshold) {
                // ...Calculate the delta between exposure and target
                uint256 target = sysState.rebalanceThreshold.sub(sysState.targetBuffer);
                protocolExposedDeltaUsd = protocolExposure[i].sub(target).mul(sysState.totalCurrentAssetsUsd).div(
                    PERCENTAGE_DECIMAL_FACTOR
                );
                protocolExposedIndex = i;
            }
        }
    }

    /// @notice Check if the change in a vault is above a certain threshold.
    ///     This stops a rebalance occurring from stablecoins going slightly off peg
    /// @param threshold Threshold for difference to be considered valid
    /// @param delta Difference between current exposure and target
    function invalidDelta(uint256 threshold, uint256 delta) private pure returns (bool) {
        return delta > 0 && threshold > 0 && delta < threshold.mul(DEFAULT_DECIMALS_FACTOR);
    }

    /// @notice Check if Curve vault needs to be considered in rebalance action
    /// @param sysState Struct holding info about system current state
    function needCurveVault(SystemState memory sysState) private view returns (bool) {
        uint256 currentPercent = sysState
        .curveCurrentAssetsUsd
        .add(sysState.lifeguardCurrentAssetsUsd)
        .mul(PERCENTAGE_DECIMAL_FACTOR)
        .div(sysState.totalCurrentAssetsUsd);
        return currentPercent > curvePercentThreshold;
    }
}
