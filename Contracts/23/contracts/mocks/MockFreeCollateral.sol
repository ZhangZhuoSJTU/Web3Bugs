// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/valuation/ExchangeRate.sol";
import "../internal/markets/AssetRate.sol";

import "../external/FreeCollateralExternal.sol";
import "../internal/valuation/FreeCollateral.sol";
import "../internal/portfolio/PortfolioHandler.sol";
import "../internal/AccountContextHandler.sol";
import "../internal/markets/Market.sol";
import "../global/StorageLayoutV1.sol";

contract MockFreeCollateral is StorageLayoutV1 {
    using PortfolioHandler for PortfolioState;
    using AccountContextHandler for AccountContext;
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

    function getMarketStorage(
        uint256 currencyId,
        uint256 maturity,
        uint256 blockTime
    ) public view returns (MarketParameters memory) {
        MarketParameters memory market;
        Market.loadMarket(market, currencyId, maturity, blockTime, true, 1);

        return market;
    }

    function getAccountContext(address account) external view returns (AccountContext memory) {
        return AccountContextHandler.getAccountContext(account);
    }

    function enableBitmapForAccount(
        address account,
        uint256 currencyId,
        uint256 blockTime
    ) external {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        accountContext.enableBitmapForAccount(account, currencyId, blockTime);
        accountContext.setAccountContext(account);
    }

    function setifCashAsset(
        address account,
        uint256 currencyId,
        uint256 maturity,
        int256 notional,
        uint256 blockTime
    ) external {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        bytes32 bitmap = BitmapAssetsHandler.getAssetsBitmap(account, currencyId);
        if (
            accountContext.nextSettleTime != 0 &&
            accountContext.nextSettleTime != DateTime.getTimeUTC0(blockTime)
        ) {
            revert(); // dev: invalid block time for test
        }
        accountContext.nextSettleTime = uint40(DateTime.getTimeUTC0(blockTime));

        int256 finalNotional;
        (bitmap, finalNotional) = BitmapAssetsHandler.addifCashAsset(
            account,
            currencyId,
            maturity,
            accountContext.nextSettleTime,
            notional,
            bitmap
        );
        if (finalNotional < 0)
            accountContext.hasDebt = accountContext.hasDebt | Constants.HAS_ASSET_DEBT;

        accountContext.setAccountContext(account);

        BitmapAssetsHandler.setAssetsBitmap(account, currencyId, bitmap);
    }

    function setETHRateMapping(uint256 id, ETHRateStorage calldata rs) external {
        underlyingToETHRateMapping[id] = rs;
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
        if (cashBalance < 0)
            accountContext.hasDebt = accountContext.hasDebt | Constants.HAS_CASH_DEBT;
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

    function convert(uint256 currencyId, int256 balance) public view returns (int256, int256) {
        AssetRateParameters memory assetRate = AssetRate.buildAssetRateView(currencyId);
        int256 underlying = AssetRate.convertToUnderlying(assetRate, balance);
        ETHRate memory ethRate = ExchangeRate.buildExchangeRate(currencyId);
        int256 eth = ExchangeRate.convertToETH(ethRate, underlying);

        return (underlying, eth);
    }

    event AccountContextUpdate(address indexed account);
    event Liquidation(LiquidationFactors factors);
    event Test(AccountContext context, bool updateContext);

    function freeCollateralView(address account, uint256 blockTime)
        external
        view
        returns (int256, int256[] memory)
    {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        return FreeCollateral.getFreeCollateralView(account, accountContext, blockTime);
    }

    function testFreeCollateral(address account, uint256 blockTime)
        external
        returns (int256, int256[] memory)
    {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        (int256 fcView, int256[] memory netLocal) =
            FreeCollateral.getFreeCollateralView(account, accountContext, blockTime);

        if (fcView >= 0) {
            // Refetch to clear state
            AccountContext memory accountContextNew =
                AccountContextHandler.getAccountContext(account);

            // prettier-ignore
            (int256 ethDenominatedFC, bool updateContext) =
                FreeCollateral.getFreeCollateralStateful(account, accountContextNew, blockTime);

            if (updateContext) {
                accountContextNew.setAccountContext(account);
            }

            assert(fcView == ethDenominatedFC);
        } else {
            // prettier-ignore
            (LiquidationFactors memory factors, /* */) = FreeCollateral.getLiquidationFactors(
                account, accountContext, blockTime, 1, 0);
            emit Liquidation(factors);

            assert(fcView == factors.netETHValue);
        }

        return (fcView, netLocal);
    }
}
