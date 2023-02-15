// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/valuation/AssetHandler.sol";
import "../internal/markets/Market.sol";
import "../global/StorageLayoutV1.sol";
import "@openzeppelin/contracts/utils/SafeCast.sol";

contract MockAssetHandler is StorageLayoutV1 {
    using SafeInt256 for int256;
    using AssetHandler for PortfolioAsset;
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

    function getSettlementDate(PortfolioAsset memory asset) public pure returns (uint256) {
        return asset.getSettlementDate();
    }

    function getPresentValue(
        int256 notional,
        uint256 maturity,
        uint256 blockTime,
        uint256 oracleRate
    ) public pure returns (int256) {
        int256 pv = AssetHandler.getPresentValue(notional, maturity, blockTime, oracleRate);
        if (notional > 0) assert(pv > 0);
        if (notional < 0) assert(pv < 0);

        assert(pv.abs() <= notional.abs());
        return pv;
    }

    function getRiskAdjustedPresentValue(
        CashGroupParameters memory cashGroup,
        int256 notional,
        uint256 maturity,
        uint256 blockTime,
        uint256 oracleRate
    ) public pure returns (int256) {
        int256 riskPv =
            AssetHandler.getRiskAdjustedPresentValue(
                cashGroup,
                notional,
                maturity,
                blockTime,
                oracleRate
            );
        int256 pv = getPresentValue(notional, maturity, blockTime, oracleRate);

        assert(riskPv <= pv);
        assert(riskPv.abs() <= notional.abs());
        return riskPv;
    }

    function getCashClaims(
        PortfolioAsset memory liquidityToken,
        MarketParameters memory marketState
    ) public pure returns (int256, int256) {
        (int256 cash, int256 fCash) = liquidityToken.getCashClaims(marketState);
        assert(cash > 0);
        assert(fCash > 0);
        assert(cash <= marketState.totalAssetCash);
        assert(fCash <= marketState.totalfCash);

        return (cash, fCash);
    }

    function getHaircutCashClaims(
        PortfolioAsset memory liquidityToken,
        MarketParameters memory marketState,
        CashGroupParameters memory cashGroup
    ) public pure returns (int256, int256) {
        (int256 haircutCash, int256 haircutfCash) =
            liquidityToken.getHaircutCashClaims(marketState, cashGroup);
        (int256 cash, int256 fCash) = liquidityToken.getCashClaims(marketState);

        assert(haircutCash < cash);
        assert(haircutfCash < fCash);

        return (haircutCash, haircutfCash);
    }

    function getLiquidityTokenValueRiskAdjusted(
        uint256 index,
        CashGroupParameters memory cashGroup,
        PortfolioAsset[] memory assets,
        uint256 blockTime
    )
        public
        view
        returns (
            int256,
            int256,
            PortfolioAsset[] memory
        )
    {
        MarketParameters memory market;
        (int256 assetValue, int256 pv) =
            AssetHandler.getLiquidityTokenValue(index, cashGroup, market, assets, blockTime, true);

        return (assetValue, pv, assets);
    }

    function getLiquidityTokenValue(
        uint256 index,
        CashGroupParameters memory cashGroup,
        PortfolioAsset[] memory assets,
        uint256 blockTime
    )
        public
        view
        returns (
            int256,
            int256,
            PortfolioAsset[] memory
        )
    {
        MarketParameters memory market;
        (int256 assetValue, int256 pv) =
            AssetHandler.getLiquidityTokenValue(index, cashGroup, market, assets, blockTime, false);

        return (assetValue, pv, assets);
    }

    function getNetCashGroupValue(
        PortfolioAsset[] memory assets,
        CashGroupParameters memory cashGroup,
        uint256 blockTime,
        uint256 portfolioIndex
    ) public view returns (int256, uint256) {
        MarketParameters memory market;
        return
            AssetHandler.getNetCashGroupValue(assets, cashGroup, market, blockTime, portfolioIndex);
    }
}
