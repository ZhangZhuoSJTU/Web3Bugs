// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/portfolio/PortfolioHandler.sol";
import "../internal/balances/BalanceHandler.sol";
import "../internal/settlement/SettlePortfolioAssets.sol";
import "../internal/settlement/SettleBitmapAssets.sol";
import "../internal/AccountContextHandler.sol";

/// @notice External library for settling assets, presents different options for calling methods
/// depending on their data requirements. Note that bitmapped portfolios will always be settled
/// and an empty portfolio state will be returned.
library SettleAssetsExternal {
    using PortfolioHandler for PortfolioState;
    using AccountContextHandler for AccountContext;
    event AccountSettled(address indexed account);

    function settleAssetsAndFinalize(
        address account,
        AccountContext memory accountContext
    ) external returns (AccountContext memory) {
        _settleAccount(account, accountContext, true, true);
        return accountContext;
    }

    function settleAssetsAndStorePortfolio(
        address account,
        AccountContext memory accountContext
    ) external returns (AccountContext memory, SettleAmount[] memory) {
        // prettier-ignore
        (
            SettleAmount[] memory settleAmounts,
            /* PortfolioState memory portfolioState */
        ) = _settleAccount(account, accountContext, false, true);

        return (accountContext, settleAmounts);
    }

    function settleAssetsAndReturnPortfolio(
        address account,
        AccountContext memory accountContext
    ) external returns (AccountContext memory, PortfolioState memory) {
        // prettier-ignore
        (
            /* SettleAmount[] memory settleAmounts */,
            PortfolioState memory portfolioState
        ) = _settleAccount(account, accountContext, true, false);

        return (accountContext, portfolioState);
    }

    function settleAssetsAndReturnAll(
        address account,
        AccountContext memory accountContext
    ) external returns (
        AccountContext memory,
        SettleAmount[] memory,
        PortfolioState memory
    ) {
        (
            SettleAmount[] memory settleAmounts,
            PortfolioState memory portfolioState
        ) = _settleAccount(account, accountContext, false, false);
        return (accountContext, settleAmounts, portfolioState);
    }

    function _settleAccount(
        address account,
        AccountContext memory accountContext,
        bool finalizeAmounts,
        bool finalizePortfolio
    )
        private
        returns (
            SettleAmount[] memory,
            PortfolioState memory
        )
    {
        SettleAmount[] memory settleAmounts;
        PortfolioState memory portfolioState;

        if (accountContext.bitmapCurrencyId != 0) {
            settleAmounts = _settleBitmappedAccountStateful(account, accountContext);
        } else {
            portfolioState = PortfolioHandler.buildPortfolioState(
                account,
                accountContext.assetArrayLength,
                0
            );
            settleAmounts = SettlePortfolioAssets.settlePortfolio(portfolioState, block.timestamp);

            if (finalizePortfolio) {
                accountContext.storeAssetsAndUpdateContext(account, portfolioState, false);
            }
        }

        if (finalizeAmounts) {
            BalanceHandler.finalizeSettleAmounts(account, accountContext, settleAmounts);
        }

        emit AccountSettled(account);

        return (settleAmounts, portfolioState);
    }

    function _settleBitmappedAccountStateful(
        address account,
        AccountContext memory accountContext
    ) private returns (SettleAmount[] memory) {
        (bytes32 assetsBitmap, int256 settledCash, uint256 blockTimeUTC0) =
            SettleBitmapAssets.settleBitmappedCashGroup(
                account,
                accountContext.bitmapCurrencyId,
                accountContext.nextSettleTime,
                block.timestamp
            );
        require(blockTimeUTC0 < type(uint40).max); // dev: block time utc0 overflow
        accountContext.nextSettleTime = uint40(blockTimeUTC0);

        BitmapAssetsHandler.setAssetsBitmap(account, accountContext.bitmapCurrencyId, assetsBitmap);
        SettleAmount[] memory settleAmounts = new SettleAmount[](1);
        settleAmounts[0].currencyId = accountContext.bitmapCurrencyId;
        settleAmounts[0].netCashChange = settledCash;
        return settleAmounts;
    }
}
