from itertools import product

import pytest
from brownie.convert.datatypes import Wei
from tests.constants import START_TIME, START_TIME_TREF

parameterNames = "rateDecimals,mustInvert"
parameterValues = list(product([6, 8, 18], [True, False]))


@pytest.mark.market
class TestAssetRate:
    @pytest.fixture(scope="module", autouse=True)
    def aggregator(self, MockAggregator, accounts):
        return accounts[0].deploy(MockAggregator, 18)

    @pytest.fixture(scope="module", autouse=True)
    def assetRate(self, MockAssetRate, accounts):
        return accounts[0].deploy(MockAssetRate)

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    @pytest.mark.parametrize(parameterNames, parameterValues)
    def test_build_asset_rate(
        self, accounts, MockCToken, cTokenAggregator, assetRate, rateDecimals, mustInvert
    ):
        underlyingDecimals = rateDecimals
        rateDecimals = 18 + (underlyingDecimals - 8)

        cToken = MockCToken.deploy(8, {"from": accounts[0]})
        aggregator = cTokenAggregator.deploy(cToken.address, {"from": accounts[0]})
        cToken.setAnswer(10 ** rateDecimals / 100, {"from": accounts[0]})

        rateStorage = (aggregator.address, underlyingDecimals)

        assetRate.setAssetRateMapping(1, rateStorage)

        # Tests both stateful and view methods inside this call
        (rateOracle, erRate, underlying) = assetRate.buildAssetRate(1).return_value

        assert rateOracle == aggregator.address
        assert erRate == 10 ** rateDecimals / 100
        assert underlying == 10 ** underlyingDecimals

    @pytest.mark.parametrize("underlyingDecimals", [6, 8, 18])
    def test_convert_internal_to_underlying(self, assetRate, aggregator, underlyingDecimals):
        ar = 0.01 * (10 ** (18 + (underlyingDecimals - 8)))
        rate = (aggregator.address, ar, 10 ** underlyingDecimals)

        asset = assetRate.convertToUnderlying(
            (aggregator.address, ar * 100, 10 ** underlyingDecimals), 1e8
        )
        assert asset == 1e8

        underlying = assetRate.convertToUnderlying(rate, 0)
        assert underlying == 0

        underlying = assetRate.convertToUnderlying(rate, -100e8)
        assert underlying == -1e8

        underlying = assetRate.convertToUnderlying(rate, 100e8)
        assert underlying == 1e8

        ar = 10 * (10 ** (18 + (underlyingDecimals - 8)))
        rate = (aggregator.address, ar, 10 ** underlyingDecimals)

        underlying = assetRate.convertToUnderlying(rate, 0)
        assert underlying == 0

        underlying = assetRate.convertToUnderlying(rate, -100e8)
        assert underlying == -1000e8

        underlying = assetRate.convertToUnderlying(rate, 100e8)
        assert underlying == 1000e8

    @pytest.mark.parametrize("underlyingDecimals", [6, 8, 18])
    def test_convert_from_underlying(self, assetRate, aggregator, underlyingDecimals):
        ar = 0.01 * (10 ** (18 + (underlyingDecimals - 8)))
        rate = (aggregator.address, ar, 10 ** underlyingDecimals)

        asset = assetRate.convertFromUnderlying(
            (aggregator.address, ar * 100, 10 ** underlyingDecimals), 1e8
        )
        assert asset == 1e8

        asset = assetRate.convertFromUnderlying(rate, 0)
        assert asset == 0

        asset = assetRate.convertFromUnderlying(rate, -1e8)
        assert asset == -100e8

        asset = assetRate.convertFromUnderlying(rate, 1e8)
        assert asset == 100e8

        ar = 10 * (10 ** (18 + (underlyingDecimals - 8)))
        rate = (aggregator.address, ar, 10 ** underlyingDecimals)

        asset = assetRate.convertFromUnderlying(rate, 0)
        assert asset == 0

        asset = assetRate.convertFromUnderlying(rate, -1e8)
        assert asset == -0.1e8

        asset = assetRate.convertFromUnderlying(rate, 1e8)
        assert asset == 0.1e8

    @pytest.mark.parametrize("underlyingDecimals", [6, 8, 18])
    def test_build_settlement_rate(
        self, accounts, MockCToken, cTokenAggregator, assetRate, underlyingDecimals
    ):
        cToken = MockCToken.deploy(8, {"from": accounts[0]})
        aggregator = cTokenAggregator.deploy(cToken.address, {"from": accounts[0]})
        rateSet = 0.01 * (10 ** (18 + (underlyingDecimals - 8)))
        cToken.setAnswer(rateSet, {"from": accounts[0]})

        rateStorage = (aggregator.address, underlyingDecimals)
        assetRate.setAssetRateMapping(1, rateStorage)
        txn = assetRate.buildSettlementRate(1, START_TIME_TREF, START_TIME)
        (_, rateSetStored, savedUnderlying) = txn.return_value

        assert Wei(rateSet) == rateSetStored
        assert savedUnderlying == 10 ** underlyingDecimals
        assert txn.events.count("SetSettlementRate") == 1
        assert txn.events["SetSettlementRate"]["currencyId"] == 1
        assert txn.events["SetSettlementRate"]["maturity"] == START_TIME_TREF
        assert txn.events["SetSettlementRate"]["rate"] == rateSetStored
        # Assert that token interest has been accrued
        assert txn.events.count("AccrueInterest") == 1

        # Once settlement rate is set it cannot change
        cToken.setAnswer(rateSet * 2)
        txn = assetRate.buildSettlementRate(1, START_TIME_TREF, START_TIME)
        (_, rateSetStored, savedUnderlying) = txn.return_value
        assert Wei(rateSet) == rateSetStored
        assert savedUnderlying == 10 ** underlyingDecimals
        assert txn.events.count("SetSettlementRate") == 0

    def test_build_asset_rate_stateful(self, accounts, MockCToken, cTokenAggregator, assetRate):
        cToken = MockCToken.deploy(8, {"from": accounts[0]})
        aggregator = cTokenAggregator.deploy(cToken.address, {"from": accounts[0]})
        rateSet = 0.01 * (10 ** 18)
        cToken.setAnswer(rateSet, {"from": accounts[0]})

        rateStorage = (aggregator.address, 8)
        assetRate.setAssetRateMapping(1, rateStorage)
        txn = assetRate.buildAssetRateStateful(1)
        # Assert that token interest has been accrued
        assert txn.events.count("AccrueInterest") == 1

    def test_build_asset_rate_not_set(self, accounts, MockCToken, cTokenAggregator, assetRate):
        rate = assetRate.buildAssetRateStateful(1).return_value

        assert assetRate.convertToUnderlying(rate, 1e18) == 1e18
        assert assetRate.convertFromUnderlying(rate, 1e18) == 1e18

        txn = assetRate.buildSettlementRate(1, START_TIME_TREF, START_TIME)
        assert txn.events.count("SetSettlementRate") == 0
        settlementRate = txn.return_value
        assert settlementRate == rate
