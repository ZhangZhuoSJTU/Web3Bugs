from itertools import product

import brownie
import pytest

parameterNames = "rateDecimals,mustInvert"
parameterValues = list(product([6, 8, 18], [True, False]))


@pytest.mark.valuation
class TestExchangeRate:
    @pytest.fixture(scope="module", autouse=True)
    def exchangeRate(self, MockExchangeRate, accounts):
        return accounts[0].deploy(MockExchangeRate)

    @pytest.fixture(scope="module", autouse=True)
    def aggregator(self, MockAggregator, accounts):
        return accounts[0].deploy(MockAggregator, 18)

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    def test_exchange_rate_failure(self, accounts, MockAggregator, exchangeRate):
        aggregator = accounts[0].deploy(MockAggregator, 18)
        aggregator.setAnswer(-1)
        with brownie.reverts():
            exchangeRate.buildExchangeRate(2)

        rateStorage = (aggregator.address, 18, False, 120, 80, 105)
        exchangeRate.setETHRateMapping(2, rateStorage)
        with brownie.reverts():
            exchangeRate.buildExchangeRate(2)

    @pytest.mark.parametrize(parameterNames, parameterValues)
    def test_build_exchange_rate(
        self, accounts, MockAggregator, exchangeRate, rateDecimals, mustInvert
    ):
        aggregator = accounts[0].deploy(MockAggregator, rateDecimals)
        aggregator.setAnswer(10 ** rateDecimals / 100)

        rateStorage = (aggregator.address, rateDecimals, mustInvert, 120, 80, 105)

        # Currency ID 1 == ETH, rates are hardcoded
        exchangeRate.setETHRateMapping(1, rateStorage)
        (
            erRateDecimals,
            erRate,
            erBuffer,
            erHaircut,
            liquidationDiscount,
        ) = exchangeRate.buildExchangeRate(1)

        assert erBuffer == 120
        assert erHaircut == 80
        assert liquidationDiscount == 105
        assert erRateDecimals == int(1e18)
        assert erRate == int(1e18)

        # This is a non-ETH currency
        exchangeRate.setETHRateMapping(2, rateStorage)

        (
            erRateDecimals,
            erRate,
            erBuffer,
            erHaircut,
            liquidationDiscount,
        ) = exchangeRate.buildExchangeRate(2)

        assert erBuffer == 120
        assert erHaircut == 80
        assert liquidationDiscount == 105
        assert erRateDecimals == 10 ** rateDecimals

        if mustInvert:
            assert erRate == 10 ** rateDecimals * 100
        else:
            assert erRate == 10 ** rateDecimals / 100

        aggregator2 = accounts[0].deploy(MockAggregator, 9)
        aggregator2.setAnswer(10 ** 8 / 200)

        rateStorage = (aggregator2.address, 8, mustInvert, 120, 80, 105)
        exchangeRate.setETHRateMapping(3, rateStorage)
        baseER = exchangeRate.buildExchangeRate(2)
        quoteER = exchangeRate.buildExchangeRate(3)

        computedER = exchangeRate.exchangeRate(baseER, quoteER)
        assert (computedER * quoteER[1]) / int(1e8) == baseER[1]

    def test_convert_to_eth(self, exchangeRate):
        # All internal balances are in 1e8 precision
        rate = (1e18, 0.01e18, 120, 80, 106)

        eth = exchangeRate.convertToETH((1e18, 1e18, 120, 80, 106), 1e8)
        assert eth == 0.8e8

        eth = exchangeRate.convertToETH(rate, 0)
        assert eth == 0

        eth = exchangeRate.convertToETH(rate, -100e8)
        assert eth == -1.2e8

        eth = exchangeRate.convertToETH(rate, 100e8)
        assert eth == 0.8e8

        rate = (1e8, 10e8, 120, 80, 106)

        eth = exchangeRate.convertToETH(rate, 0)
        assert eth == 0

        eth = exchangeRate.convertToETH(rate, -1e8)
        assert eth == -12e8

        eth = exchangeRate.convertToETH(rate, 1e8)
        assert eth == 8e8

    def test_convert_eth_to(self, exchangeRate):
        rate = (1e18, 0.01e18, 120, 80, 106)

        usdc = exchangeRate.convertETHTo((1e18, 1e18, 120, 80, 106), 1e8)
        assert usdc == 1e8

        usdc = exchangeRate.convertETHTo(rate, 0)
        assert usdc == 0

        # No buffer or haircut on this function
        usdc = exchangeRate.convertETHTo(rate, -1e8)
        assert usdc == -100e8

        usdc = exchangeRate.convertETHTo(rate, 1e8)
        assert usdc == 100e8

        rate = (1e18, 10e18, 120, 80, 106)

        usdc = exchangeRate.convertETHTo(rate, 0)
        assert usdc == 0

        # No buffer or haircut on this function
        usdc = exchangeRate.convertETHTo(rate, -1e8)
        assert usdc == -0.1e8

        usdc = exchangeRate.convertETHTo(rate, 1e8)
        assert usdc == 0.1e8
