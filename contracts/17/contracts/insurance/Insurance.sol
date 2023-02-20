// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../common/StructDefinitions.sol";
import "../common/Constants.sol";
import "../common/Controllable.sol";
import "../common/Whitelist.sol";
import "../interfaces/IAllocation.sol";
import "../interfaces/IInsurance.sol";
import "../interfaces/IExposure.sol";

import "../interfaces/IERC20Detailed.sol";
import "../interfaces/ILifeGuard.sol";
import "../interfaces/IVault.sol";
import "../interfaces/IBuoy.sol";
import "../interfaces/IPnL.sol";

/// @notice Contract for supporting protocol insurance logic - used for calculating large deposits,
///     withdrawals, rebalancing vaults and strategies and calculating risk exposure.
///     The gro protocol needs to ensure that all assets are kept within certain bounds,
///     defined on both a stablecoin and a protocol level. The stablecoin exposure is defined as
///     a system parameter (by governance), protocol exposure is calculated based on utilisation
///     ratio of gvt versus pwrd.
///
///     *****************************************************************************
///     Dependencies - insurance strategies
///     *****************************************************************************
///     Allocation.sol
///      - Protocol Allocation calculations
///     Exposure.sol
///      - Protocol Exposure calculations
///
///     Current system vaults : strategies:
///      - DAI vault : Harvest finance, Yearn generic lender
///      - USDC vaults : Harvest finance, Yearn generic lender
///      - USDT vault : Harvest finance, Yearn generic lender
///      - Curve vault : CurveXpool (Curve meta pool + yearn strategy)
///
///     Risk exposures:
///      - Stable coin - DAI, USDC, USDT
///      - LP tokens - 3Crv, Metapool tokens
contract Insurance is Constants, Controllable, Whitelist, IInsurance {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IAllocation public allocation;
    IExposure public exposure;

    mapping(uint256 => uint256) public underlyingTokensPercents;
    uint256 public curveVaultPercent;

    // Buffer used to ensure that exposures don't get to close to the limit
    // (defined as 100% - (utilisation ratio / 2), will ensure that
    // rebalance will trigger before any overexposures have occured
    uint256 public exposureBufferRebalance;
    // How much can be withdrawn from a single vault before triggering a whale withdrawal
    //  - Whale withdrawal will withdraw from multiple vaults based on the vaults
    //      current exposure delta (difference between current assets vs target assets).
    //      The assets will be swapped into the request asset/s (via Curve)
    uint256 public maxPercentForWithdraw;
    // How much can be deposited into a single vault before triggering a whale deposit
    //  - Whale deposit will deposit into multiple vaults based on stablecoin allocation targets.
    //      The deposited asset/s will be swapped into the desired asset amounts (via Curve)
    uint256 public maxPercentForDeposit;

    event LogNewAllocation(address allocation);
    event LogNewExposure(address exposure);
    event LogNewTargetAllocation(uint256 indexed index, uint256 percent);
    event LogNewCurveAllocation(uint256 percent);
    event LogNewExposureBuffer(uint256 buffer);
    event LogNewVaultMax(bool deposit, uint256 percent);

    modifier onlyValidIndex(uint256 index) {
        require(index >= 0 && index < N_COINS, "Invalid index value.");
        _;
    }

    /// @notice Set strategy allocation contract
    /// @param _allocation Address of allocation logic strategy
    function setAllocation(address _allocation) external onlyOwner {
        require(_allocation != address(0), "Zero address provided");
        allocation = IAllocation(_allocation);
        emit LogNewAllocation(_allocation);
    }

    /// @notice Set exposure contract
    /// @param _exposure Address of exposure logic strategy
    function setExposure(address _exposure) external onlyOwner {
        require(_exposure != address(0), "Zero address provided");
        exposure = IExposure(_exposure);
        emit LogNewExposure(_exposure);
    }

    /// @notice Set allocation target for stablecoins
    /// @param coinIndex Protocol index of stablecoin
    /// @param percent Target allocation percent
    function setUnderlyingTokenPercent(uint256 coinIndex, uint256 percent) external override onlyValidIndex(coinIndex) {
        require(msg.sender == controller || msg.sender == owner(), "setUnderlyingTokenPercent: !authorized");
        underlyingTokensPercents[coinIndex] = percent;
        emit LogNewTargetAllocation(coinIndex, percent);
    }

    function setCurveVaultPercent(uint256 _curveVaultPercent) external onlyOwner {
        curveVaultPercent = _curveVaultPercent;
        emit LogNewCurveAllocation(_curveVaultPercent);
    }

    /// @notice Set target for exposure buffer, this is used by the system to determine when to rebalance
    /// @param rebalanceBuffer Buffer percentage
    function setExposureBufferRebalance(uint256 rebalanceBuffer) external onlyOwner {
        exposureBufferRebalance = rebalanceBuffer;
        emit LogNewExposureBuffer(rebalanceBuffer);
    }

    /// @notice Set max percent of the vault assets for whale withdrawal,
    ///     if the withdrawal amount <= max percent * the total assets of target vault,
    ///     withdraw target assets from single vault
    /// @param _maxPercentForWithdraw Target max pecent in %BP
    function setWhaleThresholdWithdraw(uint256 _maxPercentForWithdraw) external onlyOwner {
        maxPercentForWithdraw = _maxPercentForWithdraw;
        emit LogNewVaultMax(false, _maxPercentForWithdraw);
    }

    /// @notice Set max percent of the vault assets for whale deposits,
    ///     if the deposit amount >= max percent * the total assets of target vault,
    ///     deposit into single vault
    /// @param _maxPercentForDeposit Target max pecent in %BP
    function setWhaleThresholdDeposit(uint256 _maxPercentForDeposit) external onlyOwner {
        maxPercentForDeposit = _maxPercentForDeposit;
        emit LogNewVaultMax(true, _maxPercentForDeposit);
    }

    /// @notice Deposit deltas => stablecoin allocation targets. Large deposits will thus
    ///     always push the system towards a steady state
    function calculateDepositDeltasOnAllVaults() public view override returns (uint256[N_COINS] memory) {
        return getStablePercents();
    }

    /// @notice Get the vaults order by their current exposure
    /// @param amount Amount deposited
    function getVaultDeltaForDeposit(uint256 amount)
        external
        view
        override
        returns (
            uint256[N_COINS] memory,
            uint256[N_COINS] memory,
            uint256
        )
    {
        uint256[N_COINS] memory investDelta;
        uint256[N_COINS] memory vaultIndexes;
        (uint256 totalAssets, uint256[N_COINS] memory vaultAssets) = exposure.getUnifiedAssets(_controller().vaults());
        // If deposited amount is less than the deposit limit for a the system, the
        // deposited is treated as a tuna deposit (single vault target)...
        if (amount < totalAssets.mul(maxPercentForDeposit).div(PERCENTAGE_DECIMAL_FACTOR)) {
            uint256[N_COINS] memory _vaultIndexes = exposure.sortVaultsByDelta(
                false,
                totalAssets,
                vaultAssets,
                getStablePercents()
            );
            investDelta[vaultIndexes[0]] = 10000;
            vaultIndexes[0] = _vaultIndexes[0];
            vaultIndexes[1] = _vaultIndexes[1];
            vaultIndexes[2] = _vaultIndexes[2];

            return (investDelta, vaultIndexes, 1);
            // ...Else its a whale deposit, and the deposit will be spread across all vaults,
            // based on allocation targets
        } else {
            return (investDelta, vaultIndexes, N_COINS);
        }
    }

    /// @notice Sort vaults by the delta of target asset - current asset,
    ///     only support 3 vaults now
    /// @param bigFirst Return array order most exposed -> least exposed
    function sortVaultsByDelta(bool bigFirst) external view override returns (uint256[N_COINS] memory vaultIndexes) {
        (uint256 totalAssets, uint256[N_COINS] memory vaultAssets) = exposure.getUnifiedAssets(_controller().vaults());
        return exposure.sortVaultsByDelta(bigFirst, totalAssets, vaultAssets, getStablePercents());
    }

    /// @notice Prepares system for rebalance by comparing current system risk exposure to target exposure
    function rebalanceTrigger() external view override returns (bool sysNeedRebalance) {
        SystemState memory sysState = prepareCalculation();
        sysState.utilisationRatio = IPnL(_controller().pnl()).utilisationRatio();
        sysState.rebalanceThreshold = PERCENTAGE_DECIMAL_FACTOR.sub(sysState.utilisationRatio.div(2)).sub(
            exposureBufferRebalance
        );
        ExposureState memory expState = exposure.calcRiskExposure(sysState);
        sysNeedRebalance = expState.stablecoinExposed || expState.protocolExposed;
    }

    /// @notice Rebalance will check the exposure and calculate the delta of overexposed assets/protocols.
    ///     Rebalance will attempt to withdraw assets from overexposed strategies to minimize protocol exposure.
    ///     After which it will pull assets out from overexposed vaults and invest the freed up assets
    ///     to the other stablecoin vaults.
    function rebalance() external override onlyWhitelist {
        SystemState memory sysState = prepareCalculation();
        sysState.utilisationRatio = IPnL(_controller().pnl()).utilisationRatio();
        sysState.rebalanceThreshold = PERCENTAGE_DECIMAL_FACTOR.sub(sysState.utilisationRatio.div(2)).sub(
            exposureBufferRebalance
        );
        ExposureState memory expState = exposure.calcRiskExposure(sysState);
        /// If the system is in an OK state, do nothing...
        if (!expState.stablecoinExposed && !expState.protocolExposed) return;
        /// ...Else, trigger a rebalance
        sysState.targetBuffer = exposureBufferRebalance;
        AllocationState memory allState = allocation.calcSystemTargetDelta(sysState, expState);
        _rebalance(allState);
    }

    /// @notice Rebalancing for large withdrawals, calculates changes in utilisation ratio based
    ///     on the amount withdrawn, and rebalances to get additional assets for withdrawal
    /// @param withdrawUsd Target USD amount to withdraw
    /// @param pwrd Pwrd or gvt
    function rebalanceForWithdraw(uint256 withdrawUsd, bool pwrd) external override returns (bool) {
        require(msg.sender == _controller().withdrawHandler(), "rebalanceForWithdraw: !withdrawHandler");
        return withdraw(withdrawUsd, pwrd);
    }

    /// @notice Determine if part of a deposit should be routed to the LP vault - This only applies
    ///     to Tuna and Whale deposits
    /// @dev If the current Curve exposure > target curve exposure, no more assets should be invested
    ///     to the LP vault
    function calcSkim() external view override returns (uint256) {
        IPnL pnl = IPnL(_controller().pnl());
        (uint256 gvt, uint256 pwrd) = pnl.calcPnL();
        uint256 totalAssets = gvt.add(pwrd);
        uint256 curveAssets = IVault(_controller().curveVault()).totalAssets();
        if (totalAssets != 0 && curveAssets.mul(PERCENTAGE_DECIMAL_FACTOR).div(totalAssets) >= curveVaultPercent) {
            return 0;
        }
        return curveVaultPercent;
    }

    /// @notice Calculate assets distribution for strategies
    function getStrategiesTargetRatio(uint256 utilRatio) external view override returns (uint256[] memory) {
        return allocation.calcStrategyPercent(utilRatio);
    }

    /// @notice Get protocol and vault total assets
    function prepareCalculation() public view returns (SystemState memory systemState) {
        ILifeGuard lg = getLifeGuard();
        IBuoy buoy = IBuoy(lg.getBuoy());
        require(buoy.safetyCheck());
        IVault curve = IVault(_controller().curveVault());
        systemState.lifeguardCurrentAssetsUsd = lg.totalAssetsUsd();
        systemState.curveCurrentAssetsUsd = buoy.lpToUsd(curve.totalAssets());
        systemState.totalCurrentAssetsUsd = systemState.lifeguardCurrentAssetsUsd.add(
            systemState.curveCurrentAssetsUsd
        );
        systemState.curvePercent = curveVaultPercent;
        address[N_COINS] memory vaults = _controller().vaults();
        // Stablecoin total assets
        for (uint256 i = 0; i < N_COINS; i++) {
            IVault vault = IVault(vaults[i]);
            uint256 vaultAssets = vault.totalAssets();
            uint256 vaultAssetsUsd = buoy.singleStableToUsd(vaultAssets, i);
            systemState.totalCurrentAssetsUsd = systemState.totalCurrentAssetsUsd.add(vaultAssetsUsd);
            systemState.vaultCurrentAssets[i] = vaultAssets;
            systemState.vaultCurrentAssetsUsd[i] = vaultAssetsUsd;
        }
        systemState.stablePercents = getStablePercents();
    }

    /// @notice Logic for large withdrawals - We attempt to optimize large withdrawals on both
    ///     vault and strategy level - depending on the quantity being withdrawn, we try to limit
    ///     gas costs by reducing the number of vaults and strategies to interact with
    /// @param amount Amount to withdraw in USD
    /// @param pwrd Is pwrd or vault being burned - affects withdrawal queue
    function withdraw(uint256 amount, bool pwrd) private returns (bool curve) {
        address[N_COINS] memory vaults = _controller().vaults();

        // Determine if it's possible to withdraw from one or two vaults without breaking exposure
        (uint256 withdrawType, uint256[N_COINS] memory withdrawalAmounts) = calculateWithdrawalAmountsOnPartVaults(
            amount,
            vaults
        );

        // If it's not possible to withdraw from a subset of the vaults, calculate how much
        // to withdraw from each based on current amounts in vaults vs allocation targets

        // Withdraw from more than one vault
        if (withdrawType > 1) {
            // Withdraw from all stablecoin vaults
            if (withdrawType == 2)
                withdrawalAmounts = calculateWithdrawalAmountsOnAllVaults(amount, vaults);
                // Withdraw from all stable coin vaults + LP vault
            else {
                // withdrawType == 3
                for (uint256 i; i < N_COINS; i++) {
                    withdrawalAmounts[i] = IVault(vaults[i]).totalAssets();
                }
            }
        }
        ILifeGuard lg = getLifeGuard();
        for (uint256 i = 0; i < N_COINS; i++) {
            // Withdraw assets from vault adaptor - if assets are available they will be pulled
            // direcly from the adaptor, otherwise assets will have to be pulled from the underlying
            // strategies, which will costs additional gas
            if (withdrawalAmounts[i] > 0) {
                IVault(vaults[i]).withdrawByStrategyOrder(withdrawalAmounts[i], address(lg), pwrd);
            }
        }

        if (withdrawType == 3) {
            // If more assets are needed than are available in the stablecoin vaults,
            // assets will be withdrawn from the LP Vault. This possibly involves additional
            // fees, which will be deducted from the users withdrawal amount.
            IBuoy buoy = IBuoy(lg.getBuoy());
            uint256[N_COINS] memory _withdrawalAmounts;
            _withdrawalAmounts[0] = withdrawalAmounts[0];
            _withdrawalAmounts[1] = withdrawalAmounts[1];
            _withdrawalAmounts[2] = withdrawalAmounts[2];
            uint256 leftUsd = amount.sub(buoy.stableToUsd(_withdrawalAmounts, false));
            IVault curveVault = IVault(_controller().curveVault());
            uint256 curveVaultUsd = buoy.lpToUsd(curveVault.totalAssets());
            require(curveVaultUsd > leftUsd, "no enough system assets");
            curveVault.withdraw(buoy.usdToLp(leftUsd), address(lg));
            curve = true;
        }
    }

    /// @notice Calculate withdrawal amounts based on part vaults, if the sum of part vaults'
    ///     maxWithdrawal can meet required amount, return true and valid array,
    ///     otherwise return false and invalid array
    /// @return withdrawType
    ///     1 - withdraw from part stablecoin vaults
    ///     2 - withdraw from all stablecoin vaults
    ///     3 - withdraw from all stablecoin vaults and Curve vault/lifeguard
    function calculateWithdrawalAmountsOnPartVaults(uint256 amount, address[N_COINS] memory vaults)
        private
        view
        returns (uint256 withdrawType, uint256[N_COINS] memory withdrawalAmounts)
    {
        uint256 maxWithdrawal;
        uint256 leftAmount = amount;
        uint256 vaultIndex;
        (uint256 totalAssets, uint256[N_COINS] memory vaultAssets) = exposure.getUnifiedAssets(vaults);
        if (amount > totalAssets) {
            withdrawType = 3;
        } else {
            withdrawType = 2;
            // Get list of vaults order by most exposed => least exposed
            uint256[N_COINS] memory vaultIndexes = exposure.sortVaultsByDelta(
                true,
                totalAssets,
                vaultAssets,
                getStablePercents()
            );

            IBuoy buoy = IBuoy(getLifeGuard().getBuoy());
            // Establish how much needs to be withdrawn from each vault
            for (uint256 i; i < N_COINS - 1; i++) {
                vaultIndex = vaultIndexes[i];
                // Limit of how much can be withdrawn from this vault
                maxWithdrawal = vaultAssets[vaultIndex].mul(maxPercentForWithdraw).div(PERCENTAGE_DECIMAL_FACTOR);
                // If withdraw amount exceeds withdraw capacity, withdraw remainder
                // from next vault in list...
                if (leftAmount > maxWithdrawal) {
                    withdrawalAmounts[vaultIndex] = buoy.singleStableFromUsd(maxWithdrawal, int128(vaultIndex));
                    leftAmount = leftAmount.sub(maxWithdrawal);
                    // ...Else, stop. Withdrawal covered by one vault.
                } else {
                    withdrawType = 1;
                    withdrawalAmounts[vaultIndex] = buoy.singleStableFromUsd(leftAmount, int128(vaultIndex));
                    break;
                }
            }
        }
    }

    /// @notice Calcualte difference between vault current assets and target assets
    /// @param withdrawUsd USD value of withdrawals
    function getDelta(uint256 withdrawUsd) external view override returns (uint256[N_COINS] memory delta) {
        address[N_COINS] memory vaults = _controller().vaults();
        delta = exposure.calcRoughDelta(getStablePercents(), vaults, withdrawUsd);
    }

    /// @notice Calculate withdrawal amounts based on target percents of all vaults,
    ///     if one withdrawal amount > one vault's total asset, use rebalance calculation
    function calculateWithdrawalAmountsOnAllVaults(uint256 amount, address[N_COINS] memory vaults)
        private
        view
        returns (uint256[N_COINS] memory withdrawalAmounts)
    {
        // Simple == true - withdraw from all vaults based on target percents
        bool simple = true;
        // First pass uses rough usd calculations to asses the distribution of withdrawals
        // from the vaults...
        uint256[N_COINS] memory delta = exposure.calcRoughDelta(getStablePercents(), vaults, amount);
        for (uint256 i = 0; i < N_COINS; i++) {
            IVault vault = IVault(vaults[i]);
            withdrawalAmounts[i] = amount
            .mul(delta[i])
            .mul(uint256(10)**IERC20Detailed(vault.token()).decimals())
            .div(PERCENTAGE_DECIMAL_FACTOR)
            .div(DEFAULT_DECIMALS_FACTOR);
            if (withdrawalAmounts[i] > vault.totalAssets()) {
                simple = false;
                break;
            }
        }
        // ...If this doesn't work, we do a more complex calculation to establish
        // how much we need to withdraw
        if (!simple) {
            (withdrawalAmounts, ) = calculateVaultSwapData(amount);
        }
    }

    /// @notice calculateVaultsSwapData will compare the current asset excluding withdraw
    ///     amount with target for each vault
    ///     swapInAmounts Stores the coin need to be withdraw above the target in vault
    ///     swapOutPercent Stores the required percent for vault below target
    /// @param withdrawAmount The whale withdraw amount
    function calculateVaultSwapData(uint256 withdrawAmount)
        private
        view
        returns (uint256[N_COINS] memory swapInAmounts, uint256[N_COINS] memory swapOutPercents)
    {
        // Calculate total assets and total number of strategies
        SystemState memory state = prepareCalculation();

        require(withdrawAmount < state.totalCurrentAssetsUsd, "Withdrawal exceeds system assets");
        state.totalCurrentAssetsUsd = state.totalCurrentAssetsUsd.sub(withdrawAmount);

        StablecoinAllocationState memory stableState = allocation.calcVaultTargetDelta(state, false);
        swapInAmounts = stableState.swapInAmounts;
        swapOutPercents = stableState.swapOutPercents;
    }

    function getLifeGuard() private view returns (ILifeGuard) {
        return ILifeGuard(_controller().lifeGuard());
    }

    /// @notice Rebalance will pull assets out from the overexposed vaults
    ///     and transfer to the other vaults
    function _rebalance(AllocationState memory allState) private {
        address[N_COINS] memory vaults = _controller().vaults();
        ILifeGuard lg = getLifeGuard();
        IBuoy buoy = IBuoy(lg.getBuoy());
        // Withdraw from strategies that are overexposed
        if (allState.needProtocolWithdrawal) {
            for (uint256 i = 0; i < N_COINS; i++) {
                if (allState.protocolWithdrawalUsd[i] > 0) {
                    uint256 amount = buoy.singleStableFromUsd(allState.protocolWithdrawalUsd[i], int128(i));
                    IVault(vaults[i]).withdrawByStrategyIndex(
                        amount,
                        IVault(vaults[i]).vault(),
                        allState.protocolExposedIndex
                    );
                }
            }
        }

        bool hasWithdrawal = moveAssetsFromVaultsToLifeguard(
            vaults,
            allState.stableState.swapInAmounts,
            lg,
            allState.needProtocolWithdrawal ? 0 : allState.protocolExposedIndex,
            allState.strategyTargetRatio // Only adjust strategy ratio here
        );

        // Withdraw from Curve vault
        uint256 curveDeltaUsd = allState.stableState.curveTargetDeltaUsd;
        if (curveDeltaUsd > 0) {
            uint256 usdAmount = lg.totalAssetsUsd();
            // This step moves all lifeguard assets into swap out stablecoin vaults, it might cause
            // protocol over exposure in some edge cases after invest/harvest. But it won't have a
            // large impact on the system, as investToCurve should be run periodically by external actors,
            // minimising the total amount of assets in the lifeguard.
            //   - Its recommended to check the total assets in the lifeguard and run the invest to curve
            //   trigger() to determine if investToCurve needs to be run manually before rebalance
            lg.depositStable(true);
            if (usdAmount < curveDeltaUsd) {
                IVault(_controller().curveVault()).withdraw(buoy.usdToLp(curveDeltaUsd.sub(usdAmount)), address(lg));
            }
        }

        if (curveDeltaUsd == 0 && hasWithdrawal) lg.depositStable(false);

        // Keep buffer asset in lifeguard and convert the rest of the assets to target stablecoin.
        // If swapOutPercent all are zero, don't run prepareInvestment
        for (uint256 i = 0; i < N_COINS; i++) {
            if (allState.stableState.swapOutPercents[i] > 0) {
                uint256[N_COINS] memory _swapOutPercents;
                _swapOutPercents[0] = allState.stableState.swapOutPercents[0];
                _swapOutPercents[1] = allState.stableState.swapOutPercents[1];
                _swapOutPercents[2] = allState.stableState.swapOutPercents[2];
                lg.invest(0, _swapOutPercents);
                break;
            }
        }
    }

    /// @notice Move assets from Strategies to lifeguard in preparation to have them
    ///     swapped and redistributed to other stablecoin vaults
    /// @param vaults Underlying vaults
    /// @param swapInAmounts Amount to remove from vault
    /// @param lg Lifeguard
    /// @param strategyIndex Index of strategy to withdraw from
    /// @param strategyTargetRatio Targets debt ratios of strategies
    function moveAssetsFromVaultsToLifeguard(
        address[N_COINS] memory vaults,
        uint256[N_COINS] memory swapInAmounts,
        ILifeGuard lg,
        uint256 strategyIndex,
        uint256[] memory strategyTargetRatio
    ) private returns (bool) {
        bool moved = false;

        for (uint256 i = 0; i < N_COINS; i++) {
            IVault vault = IVault(vaults[i]);
            if (swapInAmounts[i] > 0) {
                moved = true;
                vault.withdrawByStrategyIndex(swapInAmounts[i], address(lg), strategyIndex);
            }
            vault.updateStrategyRatio(strategyTargetRatio);
        }

        return moved;
    }

    function getStablePercents() private view returns (uint256[N_COINS] memory stablePercents) {
        for (uint256 i = 0; i < N_COINS; i++) {
            stablePercents[i] = underlyingTokensPercents[i];
        }
    }
}
