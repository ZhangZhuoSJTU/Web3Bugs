// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/AccountContextHandler.sol";
import "../internal/portfolio/PortfolioHandler.sol";
import "../global/StorageLayoutV1.sol";

contract MockPortfolioHandler is StorageLayoutV1 {
    using PortfolioHandler for PortfolioState;
    using AccountContextHandler for AccountContext;

    function getAssetArray(address account) external view returns (PortfolioAsset[] memory) {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        return PortfolioHandler.getSortedPortfolio(account, accountContext.assetArrayLength);
    }

    function addAsset(
        PortfolioState memory portfolioState,
        uint256 currencyId,
        uint256 maturity,
        uint256 assetType,
        int256 notional
    ) public pure returns (PortfolioState memory) {
        portfolioState.addAsset(currencyId, maturity, assetType, notional);

        return portfolioState;
    }

    function getAccountContext(address account) external view returns (AccountContext memory) {
        return AccountContextHandler.getAccountContext(account);
    }

    function storeAssets(address account, PortfolioState memory portfolioState)
        public
        returns (AccountContext memory)
    {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        accountContext.storeAssetsAndUpdateContext(account, portfolioState, false);
        accountContext.setAccountContext(account);

        return accountContext;
    }

    function deleteAsset(PortfolioState memory portfolioState, uint256 index)
        public
        pure
        returns (PortfolioState memory)
    {
        portfolioState.deleteAsset(index);

        return portfolioState;
    }

    function buildPortfolioState(address account, uint256 newAssetsHint)
        public
        view
        returns (PortfolioState memory)
    {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);

        return
            PortfolioHandler.buildPortfolioState(
                account,
                accountContext.assetArrayLength,
                newAssetsHint
            );
    }
}
