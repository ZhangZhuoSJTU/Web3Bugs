// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/markets/CashGroup.sol";
import "../internal/markets/AssetRate.sol";
import "../internal/markets/Market.sol";
import "../global/StorageLayoutV1.sol";

contract MockMarket is StorageLayoutV1 {
    using CashGroup for CashGroupParameters;
    using Market for MarketParameters;
    using AssetRate for AssetRateParameters;
    using SafeInt256 for int256;

    function getUint64(uint256 value) public pure returns (int128) {
        return ABDKMath64x64.fromUInt(value);
    }

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

    function getExchangeRate(
        int256 totalfCash,
        int256 totalCashUnderlying,
        int256 rateScalar,
        int256 rateAnchor,
        int256 fCashAmount
    ) external pure returns (int256, bool) {
        return
            Market._getExchangeRate(
                totalfCash,
                totalCashUnderlying,
                rateScalar,
                rateAnchor,
                fCashAmount
            );
    }

    function logProportion(int256 proportion) external pure returns (int256, bool) {
        return Market._logProportion(proportion);
    }

    function getImpliedRate(
        int256 totalfCash,
        int256 totalCashUnderlying,
        int256 rateScalar,
        int256 rateAnchor,
        uint256 timeToMaturity
    ) external pure returns (uint256) {
        return
            Market.getImpliedRate(
                totalfCash,
                totalCashUnderlying,
                rateScalar,
                rateAnchor,
                timeToMaturity
            );
    }

    function getRateAnchor(
        int256 totalfCash,
        uint256 lastImpliedRate,
        int256 totalCashUnderlying,
        int256 rateScalar,
        uint256 timeToMaturity
    ) external pure returns (int256, bool) {
        return
            Market._getRateAnchor(
                totalfCash,
                lastImpliedRate,
                totalCashUnderlying,
                rateScalar,
                timeToMaturity
            );
    }

    function calculateTrade(
        MarketParameters memory marketState,
        CashGroupParameters memory cashGroup,
        int256 fCashAmount,
        uint256 timeToMaturity,
        uint256 marketIndex
    )
        external
        view
        returns (
            MarketParameters memory,
            int256,
            int256
        )
    {
        (int256 assetCash, int256 fee) =
            marketState.calculateTrade(cashGroup, fCashAmount, timeToMaturity, marketIndex);

        return (marketState, assetCash, fee);
    }

    function addLiquidity(MarketParameters memory marketState, int256 assetCash)
        public
        pure
        returns (
            MarketParameters memory,
            int256,
            int256
        )
    {
        (int256 liquidityTokens, int256 fCash) = marketState.addLiquidity(assetCash);
        assert(liquidityTokens >= 0);
        assert(fCash <= 0);
        return (marketState, liquidityTokens, fCash);
    }

    function removeLiquidity(MarketParameters memory marketState, int256 tokensToRemove)
        public
        pure
        returns (
            MarketParameters memory,
            int256,
            int256
        )
    {
        (int256 assetCash, int256 fCash) = marketState.removeLiquidity(tokensToRemove);

        assert(assetCash >= 0);
        assert(fCash >= 0);
        return (marketState, assetCash, fCash);
    }

    function setMarketStorage(
        uint256 currencyId,
        uint256 settlementDate,
        MarketParameters memory market
    ) public {
        market.storageSlot = Market.getSlot(currencyId, market.maturity, settlementDate);
        // ensure that state gets set
        market.storageState = 0xFF;
        market.setMarketStorage();
    }

    function setMarketStorageSimulate(MarketParameters memory market) public {
        // This is to simulate a real market storage
        market.setMarketStorage();
    }

    function getMarketStorageOracleRate(bytes32 slot) public view returns (uint256) {
        bytes32 data;

        assembly {
            data := sload(slot)
        }
        return uint256(uint32(uint256(data >> 192)));
    }

    function buildMarket(
        uint256 currencyId,
        uint256 maturity,
        uint256 blockTime,
        bool needsLiquidity,
        uint256 rateOracleTimeWindow
    ) public view returns (MarketParameters memory) {
        MarketParameters memory market;
        market.loadMarket(currencyId, maturity, blockTime, needsLiquidity, rateOracleTimeWindow);
        return market;
    }

    function getSettlementMarket(
        uint256 currencyId,
        uint256 maturity,
        uint256 settlementDate
    ) public view returns (SettlementMarket memory) {
        return Market.getSettlementMarket(currencyId, maturity, settlementDate);
    }

    function setSettlementMarket(SettlementMarket memory market) public {
        return Market.setSettlementMarket(market);
    }

    function getfCashAmountGivenCashAmount(
        MarketParameters memory market,
        CashGroupParameters memory cashGroup,
        int256 netCashToAccount,
        uint256 marketIndex,
        uint256 timeToMaturity,
        uint256 maxfCashDelta
    ) external pure returns (int256) {
        (int256 rateScalar, int256 totalCashUnderlying, int256 rateAnchor) =
            Market.getExchangeRateFactors(market, cashGroup, timeToMaturity, marketIndex);
        // Rate scalar can never be zero so this signifies a failure and we return zero
        if (rateScalar == 0) revert();
        int256 fee = Market.getExchangeRateFromImpliedRate(cashGroup.getTotalFee(), timeToMaturity);

        return
            Market.getfCashGivenCashAmount(
                market.totalfCash,
                netCashToAccount,
                totalCashUnderlying,
                rateScalar,
                rateAnchor,
                fee,
                maxfCashDelta
            );
    }
}
