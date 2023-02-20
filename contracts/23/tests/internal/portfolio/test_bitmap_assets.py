import random

import brownie
import pytest
from brownie.test import given, strategy
from tests.constants import MARKETS, RATE_PRECISION, SETTLEMENT_DATE, START_TIME, START_TIME_TREF
from tests.helpers import (
    get_bitstring_from_bitmap,
    get_cash_group_with_max_markets,
    get_market_state,
    random_asset_bitmap,
)


@pytest.mark.portfolio
class TestBitmapAssets:
    @pytest.fixture(scope="module", autouse=True)
    def bitmapAssets(self, MockBitmapAssetsHandler, accounts):
        handler = MockBitmapAssetsHandler.deploy({"from": accounts[0]})
        handler.setMarketStorage(
            1, SETTLEMENT_DATE, get_market_state(MARKETS[0], oracleRate=0.01 * RATE_PRECISION)
        )
        handler.setMarketStorage(
            1, SETTLEMENT_DATE, get_market_state(MARKETS[1], oracleRate=0.02 * RATE_PRECISION)
        )
        handler.setMarketStorage(
            1, SETTLEMENT_DATE, get_market_state(MARKETS[2], oracleRate=0.03 * RATE_PRECISION)
        )
        handler.setMarketStorage(
            1, SETTLEMENT_DATE, get_market_state(MARKETS[3], oracleRate=0.04 * RATE_PRECISION)
        )
        handler.setMarketStorage(
            1, SETTLEMENT_DATE, get_market_state(MARKETS[4], oracleRate=0.05 * RATE_PRECISION)
        )
        handler.setMarketStorage(
            1, SETTLEMENT_DATE, get_market_state(MARKETS[5], oracleRate=0.06 * RATE_PRECISION)
        )
        handler.setMarketStorage(
            1, SETTLEMENT_DATE, get_market_state(MARKETS[6], oracleRate=0.07 * RATE_PRECISION)
        )

        return handler

    @pytest.fixture(scope="module", autouse=True)
    def mockAssetRate(self, MockCToken, cTokenAggregator, accounts):
        # Deploy 8 different aggregators for each currency
        mockToken = MockCToken.deploy(8, {"from": accounts[0]})
        mockAggregator = cTokenAggregator.deploy(mockToken.address, {"from": accounts[0]})
        # Set the settlement rate to be set
        mockToken.setSupplyRate(0.01e18)
        mockToken.setAnswer(0.01e18)

        return mockAggregator

    @given(bitmap=strategy("bytes32"), currencyId=strategy("uint8"))
    def test_get_and_set_bitmap(self, bitmapAssets, bitmap, currencyId, accounts):
        if len(list(filter(lambda x: x == "1", get_bitstring_from_bitmap(bitmap)))) > 20:
            with brownie.reverts("Over max assets"):
                bitmapAssets.setAssetsBitmap(accounts[0], currencyId, bitmap)
        else:
            bitmapAssets.setAssetsBitmap(accounts[0], currencyId, bitmap)
            storedValue = bitmapAssets.getAssetsBitmap(accounts[0], currencyId)
            bmHex = brownie.convert.datatypes.HexString(bitmap.hex().ljust(64, "0"), "bytes32")

            assert bmHex == storedValue

    @given(bitmap=strategy("bytes32"), bitNum=strategy("uint", min_value=1, max_value=256))
    def test_set_ifcash_asset(self, bitmapAssets, bitmap, bitNum, accounts):
        maturity = bitmapAssets.getMaturityFromBitNum(START_TIME, bitNum)
        notional = random.randint(-1e18, 1e18)

        txn = bitmapAssets.addifCashAsset(accounts[0], 1, maturity, START_TIME, notional, bitmap)
        (newBitmap, returnVal) = txn.return_value

        setValue = bitmapAssets.getifCashAsset(accounts[0], 1, maturity)
        newBitlist = list(get_bitstring_from_bitmap(newBitmap))

        assert setValue == returnVal
        assert setValue == notional
        assert newBitlist[bitNum - 1] == "1"

        # This should net off the value
        txn = bitmapAssets.addifCashAsset(
            accounts[0], 1, maturity, START_TIME, -notional, newBitmap
        )
        (newBitmap, returnVal) = txn.return_value

        setValue = bitmapAssets.getifCashAsset(accounts[0], 1, maturity)
        newBitlist = list(get_bitstring_from_bitmap(newBitmap))

        assert setValue == returnVal
        assert setValue == 0
        assert newBitlist[bitNum - 1] == "0"

    def test_set_ifcash_asset_set_zero(self, bitmapAssets, accounts):
        maturity = bitmapAssets.getMaturityFromBitNum(START_TIME, 1)
        bitmap = brownie.convert.datatypes.HexString(0, "bytes32")
        # Ensure that setting a notional to zero does not set the bitmap
        txn = bitmapAssets.addifCashAsset(accounts[0], 1, maturity, START_TIME, 0, bitmap)
        (newBitmap, _) = txn.return_value
        assert newBitmap == bitmap

    def test_get_ifcash_array(self, bitmapAssets, accounts):
        currencyId = 1
        (bitmap, bitmapList) = random_asset_bitmap(10)

        bitIndexes = list(filter(lambda x: x[1] == "1", enumerate(bitmapList)))
        maturities = []
        for (bitNum, _) in bitIndexes:
            maturity = bitmapAssets.getMaturityFromBitNum(START_TIME, bitNum + 1)
            maturities.append(maturity)
            notional = 1e8
            bitmapAssets.addifCashAsset(accounts[0], currencyId, maturity, START_TIME, notional, "")

        bitmapAssets.setAssetsBitmap(accounts[0], currencyId, bitmap)
        portfolio = bitmapAssets.getifCashArray(accounts[0], currencyId, START_TIME)

        assert len(portfolio) == len(bitIndexes)
        for (i, asset) in enumerate(portfolio):
            assert asset[0] == 1
            assert asset[1] == maturities[i]
            assert asset[2] == 1
            assert asset[3] == 1e8

    def test_ifcash_npv(self, bitmapAssets, mockAssetRate, accounts):
        cg = get_cash_group_with_max_markets(7)
        bitmapAssets.setAssetRateMapping(1, (mockAssetRate.address, 18))
        bitmapAssets.setCashGroup(1, cg)

        cashGroup = bitmapAssets.buildCashGroupView(1)

        # TODO: test a random negative offset to next maturing asset to simulate an unsettled
        # perpetual token
        nextSettleTime = START_TIME_TREF
        # Get the max bit given the time offset
        (maxBit, _) = bitmapAssets.getBitNumFromMaturity(nextSettleTime, MARKETS[6])
        (assetsBitmap, assetsBitmapList) = random_asset_bitmap(10, maxBit)
        computedPV = 0
        computedRiskPV = 0

        # Set each ifCash slot
        for i, b in enumerate(assetsBitmapList):
            if b == "1":
                notional = random.randint(-1e12, 1e12)
                maturity = bitmapAssets.getMaturityFromBitNum(nextSettleTime, i + 1)

                bitmapAssets.addifCashAsset(
                    accounts[0],
                    1,
                    maturity,
                    nextSettleTime,
                    notional,
                    "0x00",  # bitmap doesnt matter here
                )

                if maturity <= START_TIME:
                    computedPV += notional
                    computedRiskPV += notional
                else:
                    pv = bitmapAssets.getPresentValue(cashGroup, notional, maturity, START_TIME)
                    riskPv = bitmapAssets.getRiskAdjustedPresentValue(
                        cashGroup, notional, maturity, START_TIME
                    )
                    computedPV += pv
                    computedRiskPV += riskPv

        (pv, _) = bitmapAssets.getifCashNetPresentValue(
            accounts[0],
            1,
            nextSettleTime,
            START_TIME,
            assetsBitmap,
            cashGroup,
            False,  # non risk adjusted
        )

        (riskPv, _) = bitmapAssets.getifCashNetPresentValue(
            accounts[0],
            1,
            nextSettleTime,
            START_TIME,
            assetsBitmap,
            cashGroup,
            True,  # risk adjusted
        )

        assert computedPV == pv
        assert riskPv == computedRiskPV
