import random

import pytest
from brownie.test import given, strategy
from tests.constants import SECONDS_IN_DAY, START_TIME


class TestDateTime:
    @pytest.fixture(scope="module", autouse=True)
    def dateTime(self, MockCashGroup, MockCToken, cTokenAggregator, accounts):
        return accounts[0].deploy(MockCashGroup)

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    @given(maxMarketIndex=strategy("uint8", min_value=1, max_value=7))
    def test_maturity_before_block_time(self, dateTime, maxMarketIndex):
        assert not dateTime.isValidMaturity(maxMarketIndex, START_TIME - 1, START_TIME)
        assert not dateTime.isValidMarketMaturity(maxMarketIndex, START_TIME - 1, START_TIME)

    @given(maxMarketIndex=strategy("uint8", min_value=1, max_value=7))
    def test_maturity_non_mod(self, dateTime, maxMarketIndex):
        assert not dateTime.isValidMarketMaturity(
            maxMarketIndex, 1601856000 + (91 * SECONDS_IN_DAY), 1601856000
        )

    @given(
        blockTime=strategy("uint40", min_value=START_TIME),
        maxMarketIndex=strategy("uint8", min_value=2, max_value=7),
    )
    @pytest.mark.skip_coverage
    def test_valid_market_maturity(self, dateTime, blockTime, maxMarketIndex):
        tRef = blockTime - blockTime % (90 * SECONDS_IN_DAY)
        validMarkets = [tRef + dateTime.getTradedMarket(i) for i in range(1, maxMarketIndex + 1)]

        for maturity in validMarkets:
            assert dateTime.isValidMarketMaturity(maxMarketIndex, maturity, blockTime)
            assert not dateTime.isValidMarketMaturity(
                maxMarketIndex, maturity + random.randint(0, 89 * SECONDS_IN_DAY), blockTime
            )

            (index, idiosyncratic) = dateTime.getMarketIndex(maxMarketIndex, maturity, blockTime)
            assert not idiosyncratic
            assert validMarkets[index - 1] == maturity

    @given(
        days=strategy("uint40", min_value=0, max_value=7500),
        blockTime=strategy("uint40", min_value=START_TIME),
        maxMarketIndex=strategy("uint8", min_value=2, max_value=7),
    )
    def test_bit_number(self, dateTime, days, blockTime, maxMarketIndex):
        tRef = blockTime - blockTime % (90 * SECONDS_IN_DAY)
        maturity = tRef + days * SECONDS_IN_DAY

        isValid = dateTime.isValidMaturity(maxMarketIndex, maturity, blockTime)
        maxMaturity = tRef + dateTime.getTradedMarket(maxMarketIndex)

        if maturity > maxMaturity:
            assert not isValid

        if maturity < blockTime:
            assert not isValid

        # convert the bitnum back to a maturity
        if isValid:
            (bitNum, _) = dateTime.getBitNumFromMaturity(blockTime, maturity)
            maturityRef = dateTime.getMaturityFromBitNum(blockTime, bitNum)
            assert maturity == maturityRef
