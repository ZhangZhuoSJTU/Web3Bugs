// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "./TradingAction.sol";
import "./nTokenMintAction.sol";
import "./nTokenRedeemAction.sol";
import "../SettleAssetsExternal.sol";
import "../FreeCollateralExternal.sol";
import "../../math/SafeInt256.sol";
import "../../global/StorageLayoutV1.sol";
import "../../internal/balances/BalanceHandler.sol";
import "../../internal/portfolio/PortfolioHandler.sol";
import "../../internal/AccountContextHandler.sol";
import "interfaces/notional/NotionalCallback.sol";

contract BatchAction is StorageLayoutV1 {
    using BalanceHandler for BalanceState;
    using PortfolioHandler for PortfolioState;
    using AccountContextHandler for AccountContext;
    using SafeInt256 for int256;

    /// @notice Executes a batch of balance transfers including minting and redeeming nTokens.
    /// @param account the account for the action
    /// @param actions array of balance actions to take, must be sorted by currency id
    /// @dev emit:CashBalanceChange for each balance
    /// @dev auth:msg.sender auth:ERC1155
    function batchBalanceAction(address account, BalanceAction[] calldata actions)
        external
        payable
    {
        require(account == msg.sender || msg.sender == address(this), "Unauthorized");

        // Return any settle amounts here to reduce the number of storage writes to balances
        (
            AccountContext memory accountContext,
            SettleAmount[] memory settleAmounts
        ) = _settleAccountIfRequiredAndStorePortfolio(account);

        uint256 settleAmountIndex;
        BalanceState memory balanceState;
        for (uint256 i; i < actions.length; i++) {
            if (i > 0) {
                require(actions[i].currencyId > actions[i - 1].currencyId, "Unsorted actions");
            }

            settleAmountIndex = _preTradeActions(
                account,
                settleAmountIndex,
                actions[i].currencyId,
                settleAmounts,
                balanceState,
                accountContext
            );

            _executeDepositAction(
                account,
                balanceState,
                actions[i].actionType,
                actions[i].depositActionAmount
            );

            _calculateWithdrawActionAndFinalize(
                account,
                accountContext,
                balanceState,
                actions[i].withdrawAmountInternalPrecision,
                actions[i].withdrawEntireCashBalance,
                actions[i].redeemToUnderlying
            );
        }

        // Finalize remaining settle amounts
        BalanceHandler.finalizeSettleAmounts(account, accountContext, settleAmounts);
        _finalizeAccountContext(account, accountContext);
    }

    /// @notice Executes a batch of balance transfers and trading actions
    /// @param account the account for the action
    /// @param actions array of balance actions with trades to take, must be sorted by currency id
    /// @dev emit:CashBalanceChange for each balance, emit:BatchTradeExecution for each trade set, emit:nTokenSupplyChange
    /// @dev auth:msg.sender auth:ERC1155
    function batchBalanceAndTradeAction(address account, BalanceActionWithTrades[] calldata actions)
        external
        payable
    {
        require(account == msg.sender || msg.sender == address(this), "Unauthorized");
        AccountContext memory accountContext = _batchBalanceAndTradeAction(account, actions);
        _finalizeAccountContext(account, accountContext);
    }

    function batchBalanceAndTradeActionWithCallback(
        address account,
        BalanceActionWithTrades[] calldata actions,
        bytes calldata callbackData
    ) external payable {
        require(authorizedCallbackContract[msg.sender], "Unauthorized");
        AccountContext memory accountContext = _batchBalanceAndTradeAction(account, actions);
        accountContext.setAccountContext(account);
        // Be sure to set the account context before initiating the callback
        NotionalCallback(msg.sender).notionalCallback(msg.sender, account, callbackData);

        if (accountContext.hasDebt != 0x00) {
            FreeCollateralExternal.checkFreeCollateralAndRevert(account);
        }
    }

    function _batchBalanceAndTradeAction(
        address account,
        BalanceActionWithTrades[] calldata actions
    ) internal returns (AccountContext memory) {
        (
            AccountContext memory accountContext,
            SettleAmount[] memory settleAmounts,
            PortfolioState memory portfolioState
        ) = _settleAccountIfRequiredAndReturnPortfolio(account);

        uint256 settleAmountIndex;
        BalanceState memory balanceState;
        for (uint256 i; i < actions.length; i++) {
            if (i > 0) {
                require(actions[i].currencyId > actions[i - 1].currencyId, "Unsorted actions");
            }
            settleAmountIndex = _preTradeActions(
                account,
                settleAmountIndex,
                actions[i].currencyId,
                settleAmounts,
                balanceState,
                accountContext
            );

            _executeDepositAction(
                account,
                balanceState,
                actions[i].actionType,
                actions[i].depositActionAmount
            );

            if (actions[i].trades.length > 0) {
                int256 netCash;
                if (accountContext.bitmapCurrencyId != 0) {
                    require(
                        accountContext.bitmapCurrencyId == actions[i].currencyId,
                        "Invalid trades for account"
                    );
                    bool didIncurDebt;
                    (netCash, didIncurDebt) = TradingAction.executeTradesBitmapBatch(
                        account,
                        accountContext,
                        actions[i].trades
                    );
                    if (didIncurDebt) {
                        accountContext.hasDebt = accountContext.hasDebt | Constants.HAS_ASSET_DEBT;
                    }
                } else {
                    // NOTE: we return portfolio state here instead of setting it inside executeTradesArrayBatch
                    // because we want to only write to storage once after all trades are completed
                    (portfolioState, netCash) = TradingAction.executeTradesArrayBatch(
                        account,
                        actions[i].currencyId,
                        portfolioState,
                        actions[i].trades
                    );
                }

                // If the account owes cash after trading, ensure that it has enough
                if (netCash < 0) _checkSufficientCash(balanceState, netCash.neg());
                balanceState.netCashChange = balanceState.netCashChange.add(netCash);
            }

            _calculateWithdrawActionAndFinalize(
                account,
                accountContext,
                balanceState,
                actions[i].withdrawAmountInternalPrecision,
                actions[i].withdrawEntireCashBalance,
                actions[i].redeemToUnderlying
            );
        }

        if (accountContext.bitmapCurrencyId == 0) {
            accountContext.storeAssetsAndUpdateContext(account, portfolioState, false);
        }

        // Finalize remaining settle amounts
        BalanceHandler.finalizeSettleAmounts(account, accountContext, settleAmounts);
        return accountContext;
    }

    /// @dev Loads balances, nets off settle amounts and then executes deposit actions
    function _preTradeActions(
        address account,
        uint256 settleAmountIndex,
        uint256 currencyId,
        SettleAmount[] memory settleAmounts,
        BalanceState memory balanceState,
        AccountContext memory accountContext
    ) private returns (uint256) {
        while (
            settleAmountIndex < settleAmounts.length &&
            settleAmounts[settleAmountIndex].currencyId < currencyId
        ) {
            // Loop through settleAmounts to find a matching currency
            settleAmountIndex += 1;
        }

        // This saves a number of memory allocations
        balanceState.loadBalanceState(account, currencyId, accountContext);

        if (
            settleAmountIndex < settleAmounts.length &&
            settleAmounts[settleAmountIndex].currencyId == currencyId
        ) {
            balanceState.netCashChange = settleAmounts[settleAmountIndex].netCashChange;
            // Set to zero so that we don't double count later
            settleAmounts[settleAmountIndex].netCashChange = 0;
        }

        return settleAmountIndex;
    }

    /// @dev Executes deposits
    function _executeDepositAction(
        address account,
        BalanceState memory balanceState,
        DepositActionType depositType,
        uint256 depositActionAmount_
    ) private {
        int256 depositActionAmount = int256(depositActionAmount_);
        int256 assetInternalAmount;
        require(depositActionAmount >= 0);

        if (depositType == DepositActionType.None) {
            return;
        } else if (
            depositType == DepositActionType.DepositAsset ||
            depositType == DepositActionType.DepositAssetAndMintNToken
        ) {
            assetInternalAmount = balanceState.depositAssetToken(
                account,
                depositActionAmount,
                false // no force transfer
            );
        } else if (
            depositType == DepositActionType.DepositUnderlying ||
            depositType == DepositActionType.DepositUnderlyingAndMintNToken
        ) {
            assetInternalAmount = balanceState.depositUnderlyingToken(account, depositActionAmount);
        } else if (depositType == DepositActionType.ConvertCashToNToken) {
            // _executeNTokenAction, will check if the account has sufficient cash
            assetInternalAmount = depositActionAmount;
        }

        _executeNTokenAction(
            account,
            balanceState,
            depositType,
            depositActionAmount,
            assetInternalAmount
        );
    }

    /// @dev Executes nToken actions
    function _executeNTokenAction(
        address account,
        BalanceState memory balanceState,
        DepositActionType depositType,
        int256 depositActionAmount,
        int256 assetInternalAmount
    ) private {
        // After deposits have occurred, check if we are minting nTokens
        if (
            depositType == DepositActionType.DepositAssetAndMintNToken ||
            depositType == DepositActionType.DepositUnderlyingAndMintNToken ||
            depositType == DepositActionType.ConvertCashToNToken
        ) {
            _checkSufficientCash(balanceState, assetInternalAmount);
            balanceState.netCashChange = balanceState.netCashChange.sub(assetInternalAmount);

            // Converts a given amount of cash (denominated in internal precision) into nTokens
            int256 tokensMinted = nTokenMintAction.nTokenMint(
                balanceState.currencyId,
                assetInternalAmount
            );

            balanceState.netNTokenSupplyChange = balanceState.netNTokenSupplyChange.add(
                tokensMinted
            );
        } else if (depositType == DepositActionType.RedeemNToken) {
            require(
                // prettier-ignore
                balanceState
                    .storedNTokenBalance
                    .add(balanceState.netNTokenTransfer) // transfers would not occur at this point
                    .add(balanceState.netNTokenSupplyChange) >= depositActionAmount,
                "Insufficient token balance"
            );

            balanceState.netNTokenSupplyChange = balanceState.netNTokenSupplyChange.sub(
                depositActionAmount
            );

            int256 assetCash = nTokenRedeemAction(address(this)).nTokenRedeemViaBatch(
                balanceState.currencyId,
                depositActionAmount
            );

            balanceState.netCashChange = balanceState.netCashChange.add(assetCash);
        }
    }

    /// @dev Calculations any withdraws and finalizes balances
    function _calculateWithdrawActionAndFinalize(
        address account,
        AccountContext memory accountContext,
        BalanceState memory balanceState,
        uint256 withdrawAmountInternalPrecision,
        bool withdrawEntireCashBalance,
        bool redeemToUnderlying
    ) private {
        int256 withdrawAmount = int256(withdrawAmountInternalPrecision);
        require(withdrawAmount >= 0); // dev: withdraw action overflow

        if (withdrawEntireCashBalance) {
            // This option is here so that accounts do not end up with dust after lending since we generally
            // cannot calculate exact cash amounts from the liquidity curve.
            withdrawAmount = balanceState.storedCashBalance.add(balanceState.netCashChange).add(
                balanceState.netAssetTransferInternalPrecision
            );

            // If the account has a negative cash balance then cannot withdraw
            if (withdrawAmount < 0) withdrawAmount = 0;
        }

        // prettier-ignore
        balanceState.netAssetTransferInternalPrecision = balanceState
            .netAssetTransferInternalPrecision
            .sub(withdrawAmount);

        balanceState.finalize(account, accountContext, redeemToUnderlying);
    }

    function _finalizeAccountContext(address account, AccountContext memory accountContext)
        private
    {
        // At this point all balances, market states and portfolio states should be finalized. Just need to check free
        // collateral if required.
        accountContext.setAccountContext(account);
        if (accountContext.hasDebt != 0x00) {
            FreeCollateralExternal.checkFreeCollateralAndRevert(account);
        }
    }

    /// @notice When lending, adding liquidity or minting nTokens the account must have a sufficient cash balance
    /// to do so.
    function _checkSufficientCash(BalanceState memory balanceState, int256 amountInternalPrecision)
        private
        pure
    {
        require(
            amountInternalPrecision >= 0 &&
                balanceState.storedCashBalance.add(balanceState.netCashChange).add(
                    balanceState.netAssetTransferInternalPrecision
                ) >=
                amountInternalPrecision,
            "Insufficient cash"
        );
    }

    function _settleAccountIfRequiredAndReturnPortfolio(address account)
        private
        returns (
            AccountContext memory,
            SettleAmount[] memory,
            PortfolioState memory
        )
    {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        if (accountContext.mustSettleAssets()) {
            return SettleAssetsExternal.settleAssetsAndReturnAll(account, accountContext);
        }

        return (
            accountContext,
            new SettleAmount[](0),
            PortfolioHandler.buildPortfolioState(account, accountContext.assetArrayLength, 0)
        );
    }

    function _settleAccountIfRequiredAndStorePortfolio(address account)
        private
        returns (AccountContext memory, SettleAmount[] memory)
    {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        SettleAmount[] memory settleAmounts;

        if (accountContext.mustSettleAssets()) {
            return SettleAssetsExternal.settleAssetsAndStorePortfolio(account, accountContext);
        }

        return (accountContext, settleAmounts);
    }
}
