import math

import brownie
import pytest
from brownie.network.state import Chain
from brownie.test import given
from tests.constants import (
    FCASH_ASSET_TYPE,
    MARKETS,
    SECONDS_IN_DAY,
    SETTLEMENT_DATE,
    START_TIME,
    START_TIME_TREF,
)
from tests.helpers import (
    get_cash_group_with_max_markets,
    get_fcash_token,
    get_liquidity_token,
    get_market_state,
    get_portfolio_array,
    impliedRateStrategy,
)

chain = Chain()


@pytest.mark.valuation
class TestAssetHandler:
    @pytest.fixture(scope="class", autouse=True)
    def assetLibrary(self, MockAssetHandler, MockCToken, cTokenAggregator, accounts):
        assetLibrary = accounts[0].deploy(MockAssetHandler)
        ctoken = accounts[0].deploy(MockCToken, 8)
        # This is the identity rate
        ctoken.setAnswer(1e18)
        aggregator = cTokenAggregator.deploy(ctoken.address, {"from": accounts[0]})

        rateStorage = (aggregator.address, 8)
        assetLibrary.setAssetRateMapping(1, rateStorage)
        cg = get_cash_group_with_max_markets(3)
        assetLibrary.setCashGroup(1, cg)

        assetLibrary.setAssetRateMapping(2, rateStorage)
        assetLibrary.setCashGroup(2, cg)

        assetLibrary.setAssetRateMapping(3, rateStorage)
        assetLibrary.setCashGroup(3, cg)

        chain.mine(1, timestamp=START_TIME)

        assetLibrary.setMarketStorage(1, SETTLEMENT_DATE, get_market_state(MARKETS[0]))
        assetLibrary.setMarketStorage(1, SETTLEMENT_DATE, get_market_state(MARKETS[1]))
        assetLibrary.setMarketStorage(1, SETTLEMENT_DATE, get_market_state(MARKETS[2]))

        assetLibrary.setMarketStorage(2, SETTLEMENT_DATE, get_market_state(MARKETS[0]))
        assetLibrary.setMarketStorage(2, SETTLEMENT_DATE, get_market_state(MARKETS[1]))
        assetLibrary.setMarketStorage(2, SETTLEMENT_DATE, get_market_state(MARKETS[2]))

        assetLibrary.setMarketStorage(3, SETTLEMENT_DATE, get_market_state(MARKETS[0]))
        assetLibrary.setMarketStorage(3, SETTLEMENT_DATE, get_market_state(MARKETS[1]))
        assetLibrary.setMarketStorage(3, SETTLEMENT_DATE, get_market_state(MARKETS[2]))

        return assetLibrary

    @pytest.fixture(scope="class", autouse=True)
    def cashGroups(self, assetLibrary):
        marketStates = [
            get_market_state(MARKETS[0]),
            get_market_state(MARKETS[1]),
            get_market_state(MARKETS[2]),
        ]

        return [
            (assetLibrary.buildCashGroupView(1), marketStates),
            (assetLibrary.buildCashGroupView(2), marketStates),
            (assetLibrary.buildCashGroupView(3), marketStates),
        ]

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    def test_settlement_date(self, assetLibrary):
        with brownie.reverts():
            # invalid asset type
            assetLibrary.getSettlementDate((1, START_TIME_TREF, 0, 0, 0, 0))

        # fcash settlement date
        assert MARKETS[1] == assetLibrary.getSettlementDate(
            (1, MARKETS[1], FCASH_ASSET_TYPE, 0, 0, 0)
        )
        assert SETTLEMENT_DATE == assetLibrary.getSettlementDate((1, MARKETS[0], 2, 0, 0, 0))
        assert SETTLEMENT_DATE == assetLibrary.getSettlementDate((1, MARKETS[1], 3, 0, 0, 0))
        assert SETTLEMENT_DATE == assetLibrary.getSettlementDate((1, MARKETS[2], 4, 0, 0, 0))
        assert SETTLEMENT_DATE == assetLibrary.getSettlementDate((1, MARKETS[3], 5, 0, 0, 0))
        assert SETTLEMENT_DATE == assetLibrary.getSettlementDate((1, MARKETS[4], 6, 0, 0, 0))
        assert SETTLEMENT_DATE == assetLibrary.getSettlementDate((1, MARKETS[5], 7, 0, 0, 0))
        assert SETTLEMENT_DATE == assetLibrary.getSettlementDate((1, MARKETS[6], 8, 0, 0, 0))

        with brownie.reverts():
            # invalid asset type
            assetLibrary.getSettlementDate((1, START_TIME_TREF, 11, 0, 0, 0))

    def test_failure_liquidity_token_cash_claims(self, assetLibrary, cashGroups):
        marketState = get_market_state(MARKETS[0])
        (cashGroup, _) = cashGroups[0]

        with brownie.reverts():
            assetLibrary.getCashClaims(get_fcash_token(1), marketState)

        with brownie.reverts():
            assetLibrary.getHaircutCashClaims(get_fcash_token(1), marketState, cashGroup)

        with brownie.reverts():
            assetLibrary.getCashClaims((1, START_TIME_TREF, 11, 1e18, 0, 0), marketState)

        with brownie.reverts():
            assetLibrary.getHaircutCashClaims(
                (1, START_TIME_TREF, 11, 1e18, 0, 0), marketState, cashGroup
            )

        with brownie.reverts():
            assetLibrary.getCashClaims(get_liquidity_token(1, notional=-1), marketState)

        with brownie.reverts():
            assetLibrary.getHaircutCashClaims(
                get_liquidity_token(1, notional=-1), marketState, cashGroup
            )

    def test_liquidity_token_cash_claims(self, assetLibrary, cashGroups):
        marketState = get_market_state(MARKETS[1])
        (cashGroup, _) = cashGroups[0]
        token = get_liquidity_token(1, notional=0.5e18)

        (assetCashHaircut, fCashHaircut) = assetLibrary.getHaircutCashClaims(
            token, marketState, cashGroup
        )
        (assetCash, fCash) = assetLibrary.getCashClaims(token, marketState)

        assert assetCashHaircut == math.trunc(0.5e18 * 99 / 100)
        assert fCashHaircut == math.trunc(0.5e18 * 99 / 100)
        assert assetCash == 0.5e18
        assert fCash == 0.5e18

    def test_invalid_liquidity_token_value(self, assetLibrary, cashGroups):
        (cashGroup, _) = cashGroups[0]
        token = get_liquidity_token(1, maturity=MARKETS[0] + 100)

        with brownie.reverts():
            assetLibrary.getLiquidityTokenValue(0, cashGroup, [token], 0)

        with brownie.reverts():
            assetLibrary.getLiquidityTokenValueRiskAdjusted(0, cashGroup, [token], 0)

        with brownie.reverts():
            token = list(token)
            token[3] = -1000
            assetLibrary.getLiquidityTokenValueRiskAdjusted(0, cashGroup, [token], 0)

    def test_liquidity_token_value_fcash_not_found(self, assetLibrary, cashGroups):
        token = get_liquidity_token(1)
        (cashGroup, _) = cashGroups[0]
        oracleRate = get_market_state(MARKETS[0])[6]
        assetsBefore = tuple([token])

        # Case when token is not found
        (assetCash, riskAdjustedPv, assetsAfter) = assetLibrary.getLiquidityTokenValueRiskAdjusted(
            0, cashGroup, assetsBefore, START_TIME
        )

        assert assetsAfter == assetsBefore
        assert assetCash == 0.99e18
        assert riskAdjustedPv == assetLibrary.getRiskAdjustedPresentValue(
            cashGroup, 0.99e18, MARKETS[0], START_TIME, oracleRate
        )

        # Test when not risk adjusted
        (assetCash, pv, assetsAfter) = assetLibrary.getLiquidityTokenValue(
            0, cashGroup, assetsBefore, START_TIME
        )

        assert assetsAfter == assetsBefore
        assert assetCash == 1e18
        assert pv == assetLibrary.getPresentValue(1e18, MARKETS[0], START_TIME, oracleRate)

    def test_liquidity_token_value_fcash_not_found_index_positive(self, assetLibrary, cashGroups):
        token = get_liquidity_token(1, currencyId=2)
        (cashGroup, _) = cashGroups[1]
        oracleRate = get_market_state(MARKETS[0])[6]
        assetsBefore = [get_fcash_token(1, notional=-0.25e18), token]

        # Case when token is not found
        (assetCash, riskAdjustedPv, assetsAfter) = assetLibrary.getLiquidityTokenValueRiskAdjusted(
            1, cashGroup, assetsBefore, START_TIME
        )

        assert assetsAfter == assetsBefore
        assert assetCash == 0.99e18
        assert riskAdjustedPv == assetLibrary.getRiskAdjustedPresentValue(
            cashGroup, 0.99e18, MARKETS[0], START_TIME, oracleRate
        )

        # Test when not risk adjusted
        (assetCash, pv, assetsAfter) = assetLibrary.getLiquidityTokenValue(
            1, cashGroup, assetsBefore, START_TIME
        )

        assert assetsAfter == assetsBefore
        assert assetCash == 1e18
        assert pv == assetLibrary.getPresentValue(1e18, MARKETS[0], START_TIME, oracleRate)

    def test_liquidity_token_value_fcash_found(self, assetLibrary, cashGroups):
        token = get_liquidity_token(1, notional=0.5e18)
        (cashGroup, _) = cashGroups[0]
        assets = [get_fcash_token(1, notional=-0.25e18), token]

        # Case when token is found
        (assetCash, pv, assetsAfter) = assetLibrary.getLiquidityTokenValue(
            1, cashGroup, assets, START_TIME
        )

        assert assetCash == 0.5e18
        assert pv == 0
        assert assetsAfter[0][3] == 0.25e18

        (assetCash, riskAdjustedPv, assetsAfter) = assetLibrary.getLiquidityTokenValueRiskAdjusted(
            1, cashGroup, assets, START_TIME
        )

        assert assetCash == 0.5e18 * 0.99
        assert riskAdjustedPv == 0
        # Take the haircut first and then net off
        assert assetsAfter[0][3] == (0.5e18 * 0.99) - 0.25e18

    @pytest.mark.skip_coverage
    @given(oracleRate=impliedRateStrategy)
    def test_risk_adjusted_pv(self, assetLibrary, cashGroups, oracleRate):
        # has a 30 bps buffer / haircut
        (cashGroup, _) = cashGroups[0]

        # the longer dated the maturity, the lower the pv holding everything else constant
        maturities = [START_TIME + (90 * SECONDS_IN_DAY) * i for i in range(1, 50, 3)]
        prevPositivePV = 1e18
        prevNegativePV = -1e18
        for m in maturities:
            riskPVPositive = assetLibrary.getRiskAdjustedPresentValue(
                cashGroup, 1e18, m, START_TIME, oracleRate
            )
            pvPositive = assetLibrary.getPresentValue(1e18, m, START_TIME, oracleRate)

            assert pvPositive > riskPVPositive
            assert riskPVPositive < prevPositivePV or riskPVPositive == 0
            prevPositivePV = riskPVPositive

            # further away then you can hold less capital against it
            riskPVNegative = assetLibrary.getRiskAdjustedPresentValue(
                cashGroup, -1e18, m, START_TIME, oracleRate
            )
            pvNegative = assetLibrary.getPresentValue(-1e18, m, START_TIME, oracleRate)

            assert pvNegative > riskPVNegative
            assert prevNegativePV < riskPVNegative or riskPVNegative == -1e18
            prevNegativePV = riskPVNegative

    def test_floor_discount_rate(self, assetLibrary, cashGroups):
        cashGroup = cashGroups[0][0]
        riskPVNegative = assetLibrary.getRiskAdjustedPresentValue(
            cashGroup, -1e18, MARKETS[0], START_TIME, 1
        )
        assert riskPVNegative == -1e18

    def test_oracle_rate_failure(self, assetLibrary, cashGroups):
        (cashGroup, _) = cashGroups[0]
        assets = [get_fcash_token(1, maturity=MARKETS[5])]

        # Fails due to unset market
        with brownie.reverts():
            assetLibrary.getNetCashGroupValue(assets, cashGroup, START_TIME, 0)

    def test_portfolio_value_cash_group_not_found(self, assetLibrary, cashGroups):
        (cashGroup, _) = cashGroups[0]
        assets = [get_fcash_token(1, currencyId=2)]

        # Cash group not found
        (pvAsset, index) = assetLibrary.getNetCashGroupValue(assets, cashGroup, START_TIME, 0)
        assert pvAsset == 0
        assert index == 0

    def test_portfolio_value(self, assetLibrary, cashGroups):
        cgs = [cashGroups[0][0], cashGroups[1][0], cashGroups[2][0]]
        assets = get_portfolio_array(5, cgs, sorted=True)

        assetValuesRiskAdjusted = []
        i = 0
        for c in cgs:
            (av, i) = assetLibrary.getNetCashGroupValue(assets, c, START_TIME, i)
            assetValuesRiskAdjusted.append(av)

        assert len(assetValuesRiskAdjusted) == 3
        assert i == len(assets)

        totalPV = [0, 0, 0]
        for asset in assets:
            currencyId = asset[0]
            if asset[2] == FCASH_ASSET_TYPE:
                # All implied rates in this example are 0.1e9
                totalPV[currencyId - 1] += assetLibrary.getPresentValue(
                    asset[3], asset[1], START_TIME, 0.1e9
                )
            else:
                (assetCash, pv, _) = assetLibrary.getLiquidityTokenValue(
                    0, cgs[currencyId - 1], [asset], START_TIME
                )
                totalPV[currencyId - 1] += pv
                totalPV[currencyId - 1] += assetCash

        for (i, pv) in enumerate(totalPV):
            if pv == 0:
                assert assetValuesRiskAdjusted[i] == 0
            else:
                assert pv > assetValuesRiskAdjusted[i]
