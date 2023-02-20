import random

import brownie
import pytest
from brownie.test import given, strategy
from tests.constants import (
    BASIS_POINT,
    CASH_GROUP_PARAMETERS,
    NORMALIZED_RATE_TIME,
    RATE_PRECISION,
    SECONDS_IN_DAY,
    START_TIME,
)
from tests.helpers import get_cash_group_with_max_markets, get_market_state, get_tref


class TestCashGroupGetters:
    @pytest.fixture(scope="module", autouse=True)
    def mockCToken(self, MockCToken, accounts):
        ctoken = accounts[0].deploy(MockCToken, 8)
        ctoken.setAnswer(1e18)
        return ctoken

    @pytest.fixture(scope="module", autouse=True)
    def aggregator(self, cTokenAggregator, mockCToken, accounts):
        return cTokenAggregator.deploy(mockCToken.address, {"from": accounts[0]})

    @pytest.fixture(scope="module", autouse=True)
    def cashGroup(self, MockCashGroup, accounts):
        return accounts[0].deploy(MockCashGroup)

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    def test_invalid_max_market_index_settings(self, cashGroup):
        cashGroupParameters = list(CASH_GROUP_PARAMETERS)

        with brownie.reverts():
            # Cannot set max markets to 1
            cashGroupParameters[0] = 1
            cashGroup.setCashGroup(1, cashGroupParameters)

        with brownie.reverts():
            # Cannot set max markets past max value
            cashGroupParameters[0] = 10
            cashGroup.setCashGroup(1, cashGroupParameters)

        with brownie.reverts():
            # Cannot reduce max markets
            cashGroupParameters[0] = 4
            cashGroup.setCashGroup(1, cashGroupParameters)
            cashGroupParameters[0] = 3
            cashGroup.setCashGroup(1, cashGroupParameters)

    def test_invalid_fcash_haircut_settings(self, cashGroup):
        cashGroupParameters = list(CASH_GROUP_PARAMETERS)

        with brownie.reverts():
            # cannot be higher than fcash discount
            cashGroupParameters[7] = cashGroupParameters[5]
            cashGroup.setCashGroup(1, cashGroupParameters)

        with brownie.reverts():
            # cannot be higher than fcash discount
            cashGroupParameters[7] = cashGroupParameters[5] + 1
            cashGroup.setCashGroup(1, cashGroupParameters)

    def test_invalid_rate_scalar_settings(self, cashGroup):
        cashGroupParameters = list(CASH_GROUP_PARAMETERS)

        with brownie.reverts():
            # invalid length
            cashGroupParameters[0] = 3
            cashGroupParameters[9] = []
            cashGroup.setCashGroup(1, cashGroupParameters)

        with brownie.reverts():
            # cannot have zeros
            cashGroupParameters[0] = 3
            cashGroupParameters[9] = [10, 9, 0]
            cashGroup.setCashGroup(1, cashGroupParameters)

    def test_invalid_liquidity_haircut_settings(self, cashGroup):
        cashGroupParameters = list(CASH_GROUP_PARAMETERS)

        with brownie.reverts():
            # invalid length
            cashGroupParameters[0] = 3
            cashGroupParameters[10] = []
            cashGroup.setCashGroup(1, cashGroupParameters)

        with brownie.reverts():
            # cannot have more than 100
            cashGroupParameters[0] = 3
            cashGroupParameters[10] = [102, 50, 50]
            cashGroup.setCashGroup(1, cashGroupParameters)

    def test_build_cash_group(self, cashGroup, aggregator):
        # This is not tested, just used to ensure that it exists
        rateStorage = (aggregator.address, 18)

        for i in range(1, 50):
            cashGroup.setAssetRateMapping(i, rateStorage)
            maxMarketIndex = random.randint(0, 7)
            maxMarketIndex = 3
            cashGroupParameters = [
                maxMarketIndex,
                random.randint(1, 255),  # 1 rateOracleTimeWindowMin,
                random.randint(1, 255),  # 2 totalFeeBPS,
                random.randint(1, 100),  # 3 reserveFeeShare,
                random.randint(1, 255),  # 4 debtBuffer5BPS,
                random.randint(1, 255),  # 5 fCashHaircut5BPS,
                random.randint(1, 255),  # 6 settlement penalty bps,
                random.randint(1, 255),  # 7 liquidation fcash haircut
                random.randint(1, 255),  # 8 liquidation debt buffer
                # 9: token haircuts (percentages)
                tuple([100 - i for i in range(0, maxMarketIndex)]),
                # 10: rate scalar (increments of 10)
                tuple([10 - i for i in range(0, maxMarketIndex)]),
            ]

            # ensure liquidation fcash is less that fcash haircut
            if cashGroupParameters[7] >= cashGroupParameters[5]:
                cashGroupParameters[7] = cashGroupParameters[5] - 1

            if cashGroupParameters[8] >= cashGroupParameters[4]:
                cashGroupParameters[8] = cashGroupParameters[4] - 1

            cashGroup.setCashGroup(i, cashGroupParameters)

            cg = cashGroup.buildCashGroupView(i)
            assert cg[0] == i  # cash group id
            assert cg[1] == cashGroupParameters[0]  # Max market index

            assert cashGroupParameters[1] * 60 == cashGroup.getRateOracleTimeWindow(cg)
            assert cashGroupParameters[2] * BASIS_POINT == cashGroup.getTotalFee(cg)
            assert cashGroupParameters[3] == cashGroup.getReserveFeeShare(cg)
            assert cashGroupParameters[4] * 5 * BASIS_POINT == cashGroup.getDebtBuffer(cg)
            assert cashGroupParameters[5] * 5 * BASIS_POINT == cashGroup.getfCashHaircut(cg)
            assert cashGroupParameters[6] * 5 * BASIS_POINT == cashGroup.getSettlementPenalty(cg)
            assert cashGroupParameters[7] * 5 * BASIS_POINT == cashGroup.getLiquidationfCashHaircut(
                cg
            )
            assert cashGroupParameters[8] * 5 * BASIS_POINT == cashGroup.getLiquidationDebtBuffer(
                cg
            )

            for m in range(0, maxMarketIndex):
                assert cashGroupParameters[9][m] == cashGroup.getLiquidityHaircut(cg, m + 2)
                assert cashGroupParameters[10][m] * RATE_PRECISION == cashGroup.getRateScalar(
                    cg, m + 1, NORMALIZED_RATE_TIME
                )

            storage = cashGroup.deserializeCashGroupStorage(i)
            assert storage == cashGroupParameters

    @given(
        maxMarketIndex=strategy("uint8", min_value=2, max_value=7),
        blockTime=strategy("uint32", min_value=START_TIME),
    )
    def test_load_market(self, cashGroup, aggregator, maxMarketIndex, blockTime):
        rateStorage = (aggregator.address, 18)
        cashGroup.setAssetRateMapping(1, rateStorage)
        cashGroup.setCashGroup(1, get_cash_group_with_max_markets(maxMarketIndex))

        tRef = get_tref(blockTime)
        validMarkets = [tRef + cashGroup.getTradedMarket(i) for i in range(1, maxMarketIndex + 1)]
        cg = cashGroup.buildCashGroupView(1)

        for m in validMarkets:
            settlementDate = tRef + 90 * SECONDS_IN_DAY
            cashGroup.setMarketState(cg[0], m, settlementDate, get_market_state(m))

        cg = cashGroup.buildCashGroupView(1)

        for i in range(0, len(validMarkets)):
            needsLiquidity = True if random.randint(0, 1) else False
            market = cashGroup.loadMarket(cg, i + 1, needsLiquidity, blockTime)
            marketStored = cashGroup.getMarketState(cg[0], validMarkets[i], blockTime, 1)

            # Assert values are the same
            assert market[2] == marketStored[2]
            assert market[3] == marketStored[3]
            if needsLiquidity:
                assert market[4] == marketStored[4]
            else:
                assert market[4] == 0

            assert market[5] == marketStored[5]
            # NOTE: don't need to test oracleRate
            assert market[7] == marketStored[7]
            # Assert market has updated is set to false
            assert market[8] == "0x00"

    @given(
        maxMarketIndex=strategy("uint8", min_value=2, max_value=7),
        blockTime=strategy("uint32", min_value=START_TIME),
        # this is a per block interest rate of 0.2% to 42%, (rate = 2102400 * supplyRate / 1e18)
        supplyRate=strategy("uint", min_value=1e9, max_value=2e11),
    )
    def test_get_oracle_rate(
        self, cashGroup, aggregator, mockCToken, maxMarketIndex, blockTime, supplyRate
    ):
        mockCToken.setSupplyRate(supplyRate)
        cRate = supplyRate * 2102400 / 1e9

        rateStorage = (aggregator.address, 18)
        cashGroup.setAssetRateMapping(1, rateStorage)
        cashGroup.setCashGroup(1, get_cash_group_with_max_markets(maxMarketIndex))

        tRef = get_tref(blockTime)
        validMarkets = [tRef + cashGroup.getTradedMarket(i) for i in range(1, maxMarketIndex + 1)]
        impliedRates = {}
        cg = cashGroup.buildCashGroupView(1)

        for m in validMarkets:
            lastImpliedRate = random.randint(1e8, 1e9)
            impliedRates[m] = lastImpliedRate
            settlementDate = tRef + 90 * SECONDS_IN_DAY

            cashGroup.setMarketState(
                cg[0],
                m,
                settlementDate,
                get_market_state(
                    m, lastImpliedRate=lastImpliedRate, previousTradeTime=blockTime - 1000
                ),
            )

        for m in validMarkets:
            # If we fall on a valid market then the rate must match exactly
            rate = cashGroup.calculateOracleRate(cg, m, blockTime)
            assert rate == impliedRates[m]

        for i in range(0, 5):
            randomM = random.randint(blockTime + 1, validMarkets[-1])
            rate = cashGroup.calculateOracleRate(cg, randomM, blockTime)
            (marketIndex, idiosyncratic) = cashGroup.getMarketIndex(
                maxMarketIndex, randomM, blockTime
            )

            if not idiosyncratic:
                assert rate == impliedRates[randomM]
            elif marketIndex != 1:
                shortM = validMarkets[marketIndex - 2]
                longM = validMarkets[marketIndex - 1]
                assert rate > min(impliedRates[shortM], impliedRates[longM])
                assert rate < max(impliedRates[shortM], impliedRates[longM])
            else:
                assert rate > min(cRate, impliedRates[validMarkets[0]])
                assert rate < max(cRate, impliedRates[validMarkets[0]])
