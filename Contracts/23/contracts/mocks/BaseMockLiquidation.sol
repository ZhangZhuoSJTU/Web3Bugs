// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/markets/CashGroup.sol";
import "../internal/markets/Market.sol";
import "../internal/AccountContextHandler.sol";
import "../internal/portfolio/PortfolioHandler.sol";
import "../global/StorageLayoutV1.sol";

contract BaseMockLiquidation is StorageLayoutV1 {
    using PortfolioHandler for PortfolioState;
    using AccountContextHandler for AccountContext;
    using CashGroup for CashGroupParameters;
    using Market for MarketParameters;

    function setAssetRateMapping(uint256 id, AssetRateStorage calldata rs) external {
        assetToUnderlyingRateMapping[id] = rs;
    }

    function setCashGroup(uint256 id, CashGroupSettings calldata cg) external {
        CashGroup.setCashGroupStorage(id, cg);
    }

    function buildCashGroupView(uint256 currencyId)
        public
        view
        returns (CashGroupParameters memory)
    {
        return CashGroup.buildCashGroupView(currencyId);
    }

    function setMarketStorage(
        uint256 currencyId,
        uint256 settlementDate,
        MarketParameters memory market
    ) public {
        market.storageSlot = Market.getSlot(currencyId, settlementDate, market.maturity);
        // ensure that state gets set
        market.storageState = 0xFF;
        market.setMarketStorage();
    }

    function getMarkets(uint256 currencyId, uint256 blockTime)
        public
        view
        returns (MarketParameters[] memory)
    {
        CashGroupParameters memory cashGroup = CashGroup.buildCashGroupView(currencyId);
        MarketParameters[] memory markets = new MarketParameters[](cashGroup.maxMarketIndex);

        for (uint256 i = 0; i < cashGroup.maxMarketIndex; i++) {
            cashGroup.loadMarket(markets[i], i + 1, true, blockTime);
        }

        return markets;
    }

    function getPortfolio(address account) public view returns (PortfolioAsset[] memory) {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        return PortfolioHandler.getSortedPortfolio(account, accountContext.assetArrayLength);
    }

    function setETHRateMapping(uint256 id, ETHRateStorage calldata rs) external {
        underlyingToETHRateMapping[id] = rs;
    }

    function clearPortfolio(address account) external {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        PortfolioState memory portfolioState =
            PortfolioHandler.buildPortfolioState(account, accountContext.assetArrayLength, 0);
        for (uint256 i; i < portfolioState.storedAssets.length; i++) {
            portfolioState.deleteAsset(i);
        }
        accountContext.storeAssetsAndUpdateContext(account, portfolioState, false);
        accountContext.setAccountContext(account);
    }

    function setPortfolio(address account, PortfolioAsset[] memory assets) external {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        PortfolioState memory portfolioState =
            PortfolioHandler.buildPortfolioState(account, accountContext.assetArrayLength, 0);
        portfolioState.newAssets = assets;
        accountContext.storeAssetsAndUpdateContext(account, portfolioState, false);
        accountContext.setAccountContext(account);
    }

    function setBalance(
        address account,
        uint256 currencyId,
        int256 cashBalance,
        int256 nTokenBalance
    ) external {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        accountContext.setActiveCurrency(currencyId, true, Constants.ACTIVE_IN_BALANCES);
        accountContext.setAccountContext(account);

        bytes32 slot =
            keccak256(
                abi.encode(
                    currencyId,
                    keccak256(abi.encode(account, Constants.BALANCE_STORAGE_OFFSET))
                )
            );
        require(cashBalance >= type(int88).min && cashBalance <= type(int88).max); // dev: stored cash balance overflow
        // Allows for 12 quadrillion nToken balance in 1e8 decimals before overflow
        require(nTokenBalance >= 0 && nTokenBalance <= type(uint80).max); // dev: stored nToken balance overflow

        bytes32 data =
            ((bytes32(uint256(nTokenBalance))) |
                (bytes32(0) << 80) |
                (bytes32(0) << 112) |
                (bytes32(cashBalance) << 168));

        assembly {
            sstore(slot, data)
        }
    }

    function setBitmapAsset(
        address account,
        uint16 currencyId,
        uint40 nextSettleTime,
        uint256 maturity,
        int256 notional
    ) external {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        accountContext.bitmapCurrencyId = currencyId;
        accountContext.nextSettleTime = nextSettleTime;
        bytes32 assetsBitmap = BitmapAssetsHandler.getAssetsBitmap(account, currencyId);
        BitmapAssetsHandler.addifCashAsset(
            account,
            currencyId,
            maturity,
            accountContext.nextSettleTime,
            notional,
            assetsBitmap
        );
        BitmapAssetsHandler.setAssetsBitmap(account, currencyId, assetsBitmap);
        accountContext.setAccountContext(account);
    }

}
