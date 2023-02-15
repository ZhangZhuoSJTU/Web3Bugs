// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "./IYearnV2Strategy.sol";
import "../../BaseVaultAdaptor.sol";

/// @notice YearnV2Vault adaptor - Implementation of the gro protocol vault adaptor used to
///     interact with Yearn v2 vaults. Gro protocol uses a modified version of the yearnV2Vault
///     to accomodate for additional functionality (see Vault.vy):
///         - Adaptor modifier:
///             Withdraw/Deposit methods can only be accessed by the vaultAdaptor
///         - Withdraw by StrategyOrder/Index:
///             In order to be able to ensure that protocol exposures are within given thresholds
///             inside the vault, the vault can now withdraw from the vault (underlying strategies)
///             by a specific strategy or order of strategies. The orginal yearnV2Vault has a set
///             withdrawalQueue.
///         - The vault adaptor now acts as the first withdraw layer. This means that the adaptor,
///             will always try to maintain a set amount of loose assets to make withdrawals cheaper.
///             The underlying yearn vault on the other hand will always have a total debt ratio of
///             100%, meaning that it will atempt to always have all its assets invested in the
///             underlying strategies.
///         - Asset availability:
///             - VaultAdaptor:
///                 - vaultReserve (%BP - see BaseVaultAdaptor)
///             - Vault:
///                 - target debt ratio => 100% (10000)
///                 - loose assets cannot be guranteed
///                     - after a vaultAdaptor invest action assets will be available
///                     - after each strategy has called harvest no assets should be available
contract VaultAdaptorYearnV2_032 is BaseVaultAdaptor {
    constructor(address _vault, address _token) public BaseVaultAdaptor(_vault, _token) {}

    /// @notice Withdraw from vault adaptor, if withdrawal amount exceeds adaptors
    ///     total available assets, withdraw from underlying vault, using a specific
    ///     strategy order for withdrawal -> the withdrawal order dictates which strategy
    ///     to withdraw from first, if this strategies assets are exhausted before the
    ///     withdraw amount has been covered, the ramainder will be withdrawn from the next
    ///     strategy in the list.
    /// @param share Number of shares to withdraw (yVault shares)
    /// @param recipient Recipient of withdrawal
    /// @param pwrd Pwrd or gvt
    function _withdrawByStrategyOrder(
        uint256 share,
        address recipient,
        bool pwrd
    ) internal override returns (uint256) {
        if (pwrd) {
            address[MAX_STRATS] memory _strategies;
            for (uint256 i = strategiesLength; i > 0; i--) {
                _strategies[i - 1] = IYearnV2Vault(vault).withdrawalQueue((strategiesLength - i));
            }
            return IYearnV2Vault(vault).withdrawByStrategy(_strategies, share, recipient, 1);
        } else {
            return _withdraw(share, recipient);
        }
    }

    /// @notice Withdraw from vault adaptor, if withdrawal amount exceeds adaptors,
    ///     withdraw from a specific strategy
    /// @param share Number of shares to withdraw (yVault shares)
    /// @param recipient Recipient of withdrawal
    /// @param index Index of strategy
    function _withdrawByStrategyIndex(
        uint256 share,
        address recipient,
        uint256 index
    ) internal override returns (uint256) {
        if (index != 0) {
            address[MAX_STRATS] memory _strategies;
            uint256 strategyIndex = 0;
            _strategies[strategyIndex] = IYearnV2Vault(vault).withdrawalQueue(index);
            for (uint256 i = 0; i < strategiesLength; i++) {
                if (i == index) {
                    continue;
                }
                strategyIndex++;
                _strategies[strategyIndex] = IYearnV2Vault(vault).withdrawalQueue(i);
            }
            return IYearnV2Vault(vault).withdrawByStrategy(_strategies, share, recipient, 0);
        } else {
            return _withdraw(share, recipient);
        }
    }

    /// @notice Deposit from vault adaptors to underlying vaults
    /// @param _amount Amount to deposit
    function depositToUnderlyingVault(uint256 _amount) internal override {
        if (_amount > 0) {
            IYearnV2Vault(vault).deposit(_amount, address(this));
        }
    }

    function _strategyHarvest(uint256 index) internal override {
        IYearnV2Vault yearnVault = IYearnV2Vault(vault);
        IYearnV2Strategy(yearnVault.withdrawalQueue(index)).harvest();
    }

    /// @notice Set debt ratio of underlying strategies to 0
    function resetStrategyDeltaRatio() private {
        IYearnV2Vault yearnVault = IYearnV2Vault(vault);
        for (uint256 i = 0; i < strategiesLength; i++) {
            yearnVault.updateStrategyDebtRatio(yearnVault.withdrawalQueue(i), 0);
        }
    }

    function updateStrategiesDebtRatio(uint256[] memory ratios) internal override {
        uint256 ratioTotal = 0;
        for (uint256 i = 0; i < ratios.length; i++) {
            ratioTotal = ratioTotal.add(ratios[i]);
        }
        require(ratioTotal <= 10**4, "The total of ratios is more than 10000");

        resetStrategyDeltaRatio();

        IYearnV2Vault yearnVault = IYearnV2Vault(vault);
        for (uint256 i = 0; i < ratios.length; i++) {
            yearnVault.updateStrategyDebtRatio(yearnVault.withdrawalQueue(i), ratios[i]);
        }
    }

    /// @notice Return debt ratio of underlying strategies
    function getStrategiesDebtRatio() internal view override returns (uint256[] memory ratios) {
        ratios = new uint256[](strategiesLength);
        IYearnV2Vault yearnVault = IYearnV2Vault(vault);
        StrategyParams memory strategyParam;
        for (uint256 i; i < strategiesLength; i++) {
            strategyParam = yearnVault.strategies(yearnVault.withdrawalQueue(i));
            ratios[i] = strategyParam.debtRatio;
        }
    }

    function _strategyHarvestTrigger(uint256 index, uint256 callCost) internal view override returns (bool) {
        IYearnV2Vault yearnVault = IYearnV2Vault(vault);
        return IYearnV2Strategy(yearnVault.withdrawalQueue(index)).harvestTrigger(callCost);
    }

    function getStrategyEstimatedTotalAssets(uint256 index) internal view override returns (uint256) {
        IYearnV2Vault yearnVault = IYearnV2Vault(vault);
        return IYearnV2Strategy(yearnVault.withdrawalQueue(index)).estimatedTotalAssets();
    }

    function getStrategyTotalAssets(uint256 index) internal view override returns (uint256) {
        IYearnV2Vault yearnVault = IYearnV2Vault(vault);
        StrategyParams memory strategyParam = yearnVault.strategies(yearnVault.withdrawalQueue(index));
        return strategyParam.totalDebt;
    }

    function _withdraw(uint256 share, address recipient) internal override returns (uint256 withdrawalAmount) {
        (, , withdrawalAmount, ) = IYearnV2Vault(vault).withdraw(share, recipient, 1);
    }

    function vaultTotalAssets() internal view override returns (uint256) {
        return IYearnV2Vault(vault).totalAssets();
    }

    function _getVaultSharePrice() internal view override returns (uint256) {
        return IYearnV2Vault(vault).pricePerShare();
    }
}
