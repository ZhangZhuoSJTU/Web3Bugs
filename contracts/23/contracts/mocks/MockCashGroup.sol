// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/markets/CashGroup.sol";
import "../global/StorageLayoutV1.sol";

contract MockCashGroup is StorageLayoutV1 {
    using CashGroup for CashGroupParameters;
    using Market for MarketParameters;

    function setAssetRateMapping(uint256 id, AssetRateStorage calldata rs) external {
        assetToUnderlyingRateMapping[id] = rs;
    }

    function setCashGroup(uint256 id, CashGroupSettings calldata cg) external {
        CashGroup.setCashGroupStorage(id, cg);
    }

    function setMarketState(
        uint256 currencyId,
        uint256 maturity,
        uint256 settlementDate,
        MarketParameters memory ms
    ) external {
        ms.storageSlot = Market.getSlot(currencyId, settlementDate, maturity);
        // ensure that state gets set
        ms.storageState = 0xFF;
        ms.setMarketStorage();
    }

    function getMarketState(
        uint256 id,
        uint256 maturity,
        uint256 blockTime,
        uint256 timeWindow
    ) external view returns (MarketParameters memory) {
        MarketParameters memory market;
        market.loadMarket(id, maturity, blockTime, true, timeWindow);
        return market;
    }

    function getTradedMarket(uint256 index) public pure returns (uint256) {
        return DateTime.getTradedMarket(index);
    }

    function isValidMarketMaturity(
        uint256 maxMarketIndex,
        uint256 maturity,
        uint256 blockTime
    ) public pure returns (bool) {
        bool isValid = DateTime.isValidMarketMaturity(maxMarketIndex, maturity, blockTime);
        if (maturity < blockTime) assert(!isValid);

        return isValid;
    }

    function isValidMaturity(
        uint256 maxMarketIndex,
        uint256 maturity,
        uint256 blockTime
    ) public pure returns (bool) {
        bool isValid = DateTime.isValidMaturity(maxMarketIndex, maturity, blockTime);

        return isValid;
    }

    function getBitNumFromMaturity(uint256 blockTime, uint256 maturity)
        public
        pure
        returns (uint256, bool)
    {
        (uint256 bitNum, bool isValid) = DateTime.getBitNumFromMaturity(blockTime, maturity);
        assert(bitNum <= 256);
        if (isValid) assert(bitNum > 0);

        return (bitNum, isValid);
    }

    function getMaturityFromBitNum(uint256 blockTime, uint256 bitNum)
        public
        pure
        returns (uint256)
    {
        uint256 maturity = DateTime.getMaturityFromBitNum(blockTime, bitNum);
        assert(maturity > blockTime);

        return maturity;
    }

    function getRateScalar(
        CashGroupParameters memory cashGroup,
        uint256 marketIndex,
        uint256 timeToMaturity
    ) public pure returns (int256) {
        int256 rateScalar = cashGroup.getRateScalar(marketIndex, timeToMaturity);

        return rateScalar;
    }

    function getTotalFee(CashGroupParameters memory cashGroup) public pure returns (uint256) {
        return cashGroup.getTotalFee();
    }

    function getReserveFeeShare(CashGroupParameters memory cashGroup) public pure returns (int256) {
        return cashGroup.getReserveFeeShare();
    }

    function getLiquidityHaircut(CashGroupParameters memory cashGroup, uint256 timeToMaturity)
        public
        pure
        returns (uint256)
    {
        return cashGroup.getLiquidityHaircut(timeToMaturity);
    }

    function getfCashHaircut(CashGroupParameters memory cashGroup) public pure returns (uint256) {
        return cashGroup.getfCashHaircut();
    }

    function getDebtBuffer(CashGroupParameters memory cashGroup) public pure returns (uint256) {
        return cashGroup.getDebtBuffer();
    }

    function getRateOracleTimeWindow(CashGroupParameters memory cashGroup)
        public
        pure
        returns (uint256)
    {
        return cashGroup.getRateOracleTimeWindow();
    }

    function getSettlementPenalty(CashGroupParameters memory cashGroup)
        public
        pure
        returns (uint256)
    {
        return cashGroup.getSettlementPenalty();
    }

    function getLiquidationfCashHaircut(CashGroupParameters memory cashGroup)
        public
        pure
        returns (uint256)
    {
        return cashGroup.getLiquidationfCashHaircut();
    }

    function getLiquidationDebtBuffer(CashGroupParameters memory cashGroup)
        public
        pure
        returns (uint256)
    {
        return cashGroup.getLiquidationDebtBuffer();
    }

    function getMarketIndex(
        uint256 maxMarketIndex,
        uint256 maturity,
        uint256 blockTime
    ) public pure returns (uint256, bool) {
        return DateTime.getMarketIndex(maxMarketIndex, maturity, blockTime);
    }

    function loadMarket(
        CashGroupParameters memory cashGroup,
        uint256 marketIndex,
        bool needsLiquidity,
        uint256 blockTime
    ) public view returns (MarketParameters memory market) {
        cashGroup.loadMarket(market, marketIndex, needsLiquidity, blockTime);
    }

    function interpolateOracleRate(
        uint256 shortMaturity,
        uint256 longMaturity,
        uint256 shortRate,
        uint256 longRate,
        uint256 assetMaturity
    ) public pure returns (uint256) {
        uint256 rate =
            CashGroup.interpolateOracleRate(
                shortMaturity,
                longMaturity,
                shortRate,
                longRate,
                assetMaturity
            );

        if (shortRate == longRate) {
            assert(rate == shortRate);
        } else if (shortRate < longRate) {
            assert(shortRate < rate && rate < longRate);
        } else {
            assert(shortRate > rate && rate > longRate);
        }

        return rate;
    }

    function calculateOracleRate(
        CashGroupParameters memory cashGroup,
        uint256 assetMaturity,
        uint256 blockTime
    ) public view returns (uint256) {
        return cashGroup.calculateOracleRate(assetMaturity, blockTime);
    }

    function buildCashGroupView(uint256 currencyId)
        public
        view
        returns (CashGroupParameters memory)
    {
        return CashGroup.buildCashGroupView(currencyId);
    }

    function buildCashGroupStateful(uint256 currencyId)
        public
        returns (CashGroupParameters memory)
    {
        return CashGroup.buildCashGroupStateful(currencyId);
    }

    function deserializeCashGroupStorage(uint256 currencyId)
        public
        view
        returns (CashGroupSettings memory)
    {
        return CashGroup.deserializeCashGroupStorage(currencyId);
    }
}
