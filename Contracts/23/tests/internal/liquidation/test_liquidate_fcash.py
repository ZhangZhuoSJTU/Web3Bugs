import brownie
import pytest
from brownie.network.state import Chain
from tests.constants import SETTLEMENT_DATE, START_TIME
from tests.helpers import (
    get_cash_group_with_max_markets,
    get_eth_rate_mapping,
    get_fcash_token,
    get_market_curve,
)
from tests.internal.liquidation.liquidation_helpers import get_portfolio

chain = Chain()


@pytest.mark.liquidation
class TestLiquidatefCash:
    @pytest.fixture(scope="module", autouse=True)
    def ethAggregators(self, MockAggregator, accounts):
        return [
            MockAggregator.deploy(18, {"from": accounts[0]}),
            MockAggregator.deploy(18, {"from": accounts[0]}),
            MockAggregator.deploy(18, {"from": accounts[0]}),
        ]

    @pytest.fixture(scope="module", autouse=True)
    def liquidation(
        self,
        MockfCashLiquidation,
        MockCToken,
        FreeCollateralExternal,
        SettleAssetsExternal,
        cTokenAggregator,
        ethAggregators,
        accounts,
    ):
        SettleAssetsExternal.deploy({"from": accounts[0]})
        FreeCollateralExternal.deploy({"from": accounts[0]})
        liquidation = accounts[0].deploy(MockfCashLiquidation)
        ctoken = accounts[0].deploy(MockCToken, 8)
        # This is the identity rate
        ctoken.setAnswer(1e18)
        aggregator = cTokenAggregator.deploy(ctoken.address, {"from": accounts[0]})

        cg = get_cash_group_with_max_markets(3)
        rateStorage = (aggregator.address, 8)

        ethAggregators[0].setAnswer(1e18)
        liquidation.setAssetRateMapping(1, rateStorage)
        liquidation.setCashGroup(1, cg)
        liquidation.setETHRateMapping(1, get_eth_rate_mapping(ethAggregators[0], discount=104))

        ethAggregators[1].setAnswer(1e18)
        liquidation.setAssetRateMapping(2, rateStorage)
        liquidation.setCashGroup(2, cg)
        liquidation.setETHRateMapping(2, get_eth_rate_mapping(ethAggregators[1], discount=102))

        ethAggregators[2].setAnswer(1e18)
        liquidation.setAssetRateMapping(3, rateStorage)
        liquidation.setCashGroup(3, cg)
        liquidation.setETHRateMapping(3, get_eth_rate_mapping(ethAggregators[2], discount=105))

        chain.mine(1, timestamp=START_TIME)

        return liquidation

    def test_liquidate_fcash_local_positive_available_insufficient(self, liquidation, accounts):
        # This test liquidates all positive fCash
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        portfolio = get_portfolio([1, 2, 3], 1000e8, markets, START_TIME)
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(1)
        factors = (
            accounts[0],
            -10.1e8,
            1000e8,
            1000e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (accountContext, factors, portfolioState, 0, 0, 0, 0, [])
        maturities = [a[1] for a in portfolio if a[3] > 0]
        maxAmounts = [0] * len(maturities)
        positivefCash = [a[3] for a in portfolio if a[3] > 0]

        (notionals, localFromLiquidator, _) = liquidation.liquidatefCashLocal(
            accounts[0], 1, maturities, maxAmounts, fCashContext, START_TIME
        )

        assert sum(notionals) > localFromLiquidator
        assert notionals == positivefCash

    def test_liquidate_fcash_local_positive_available_sufficient(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        portfolio = [
            get_fcash_token(1, currencyId=1, notional=50000e8),
            get_fcash_token(2, currencyId=1, notional=50000e8),
            get_fcash_token(3, currencyId=1, notional=50000e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(1)
        factors = (
            accounts[0],
            -10e8,
            1000e8,
            1000e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (accountContext, factors, portfolioState, 0, 0, 0, 0, [])
        maturities = [a[1] for a in portfolio]

        (notionals, localFromLiquidator, _) = liquidation.liquidatefCashLocal(
            accounts[0], 1, maturities, [0, 0, 0], fCashContext, START_TIME
        )

        assert sum(notionals) > localFromLiquidator
        assert notionals == [50000e8, 20000e8, 0]

    def test_liquidate_fcash_local_negative_available(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        portfolio = [
            get_fcash_token(1, currencyId=1, notional=50000e8),
            get_fcash_token(2, currencyId=1, notional=50000e8),
            get_fcash_token(3, currencyId=1, notional=50000e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(1)
        factors = (
            accounts[0],
            -100e8,
            -100e8,
            1000e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (accountContext, factors, portfolioState, 0, 0, 0, 0, [])
        maturities = [a[1] for a in portfolio]

        (notionals, localFromLiquidator, _) = liquidation.liquidatefCashLocal(
            accounts[0], 1, maturities, [0, 0, 0], fCashContext, START_TIME
        )

        assert sum(notionals) > localFromLiquidator
        assert notionals == [50000e8, 50000e8, 20000e8]

    def test_liquidate_fcash_local_user_specified_max(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        portfolio = [
            get_fcash_token(1, currencyId=1, notional=50000e8),
            get_fcash_token(2, currencyId=1, notional=50000e8),
            get_fcash_token(3, currencyId=1, notional=50000e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(1)
        factors = (
            accounts[0],
            -100e8,
            -200e8,
            1000e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (accountContext, factors, portfolioState, 0, 0, 0, 0, [])
        maturities = [a[1] for a in portfolio]

        (notionals, localFromLiquidator, _) = liquidation.liquidatefCashLocal(
            accounts[0], 1, maturities, [10000e8, 20000e8, 30000e8], fCashContext, START_TIME
        )

        assert sum(notionals) > localFromLiquidator
        assert notionals == [10000e8, 20000e8, 30000e8]

    def test_liquidate_negative_fcash_sufficient(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        localCashBalanceUnderlying = 2400e8
        portfolio = [
            get_fcash_token(1, currencyId=1, notional=-10e8),
            get_fcash_token(2, currencyId=1, notional=-2200e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(1)
        factors = (
            accounts[0],
            -1e8,
            -0.1e8,
            0,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (
            accountContext,
            factors,
            portfolioState,
            localCashBalanceUnderlying,
            0,
            0,
            0,
            [],
        )
        maturities = [a[1] for a in portfolio]

        (notionals, localFromLiquidator, fCashContext) = liquidation.liquidatefCashLocal(
            accounts[0], 1, maturities, [0, 0], fCashContext, START_TIME
        )
        localCashBalanceUnderlyingAfter = fCashContext[3]
        underlyingBenefitRequired = fCashContext[4]

        assert localCashBalanceUnderlyingAfter == localCashBalanceUnderlying + localFromLiquidator
        assert localCashBalanceUnderlyingAfter > 0
        assert underlyingBenefitRequired < 10
        assert notionals == [-10e8, -880e8]
        assert sum(notionals) < localFromLiquidator

    def test_liquidate_negative_fcash_limit_by_cash_balance(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        localCashBalanceUnderlying = 500e8
        portfolio = [
            get_fcash_token(1, currencyId=1, notional=-10e8),
            get_fcash_token(2, currencyId=1, notional=-2200e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(1)
        factors = (
            accounts[0],
            -1.2e8,
            -1.2e8,
            0,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (
            accountContext,
            factors,
            portfolioState,
            localCashBalanceUnderlying,
            0,
            0,
            0,
            [],
        )
        maturities = [a[1] for a in portfolio]

        (notionals, localFromLiquidator, fCashContext) = liquidation.liquidatefCashLocal(
            accounts[0], 1, maturities, [0, 0], fCashContext, START_TIME
        )
        localCashBalanceUnderlyingAfter = fCashContext[3]
        underlyingBenefitRequired = fCashContext[4]

        assert localFromLiquidator < 0
        assert localCashBalanceUnderlyingAfter == localCashBalanceUnderlying + localFromLiquidator
        assert underlyingBenefitRequired > 10
        assert localCashBalanceUnderlyingAfter == 0
        assert sum(notionals) < localFromLiquidator

    def test_liquidate_negative_fcash_limit_insufficient(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        localCashBalanceUnderlying = 2500e8
        portfolio = [
            get_fcash_token(1, currencyId=1, notional=-10e8),
            get_fcash_token(2, currencyId=1, notional=-2200e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(1)
        factors = (
            accounts[0],
            -5e8,
            -5e8,
            0,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (
            accountContext,
            factors,
            portfolioState,
            localCashBalanceUnderlying,
            0,
            0,
            0,
            [],
        )
        maturities = [a[1] for a in portfolio]

        (notionals, localFromLiquidator, fCashContext) = liquidation.liquidatefCashLocal(
            accounts[0], 1, maturities, [0, 0], fCashContext, START_TIME
        )
        localCashBalanceUnderlyingAfter = fCashContext[3]
        underlyingBenefitRequired = fCashContext[4]

        assert localCashBalanceUnderlyingAfter == localCashBalanceUnderlying + localFromLiquidator
        assert localCashBalanceUnderlyingAfter > 0
        assert underlyingBenefitRequired > 10
        assert notionals == [-10e8, -2200e8]
        assert sum(notionals) < localFromLiquidator

    def test_liquidate_negative_fcash_limit_by_user_specified(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        localCashBalanceUnderlying = 2500e8
        portfolio = [
            get_fcash_token(1, currencyId=1, notional=-10e8),
            get_fcash_token(2, currencyId=1, notional=-2200e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(1)
        factors = (
            accounts[0],
            -5e8,
            -5e8,
            0,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (
            accountContext,
            factors,
            portfolioState,
            localCashBalanceUnderlying,
            0,
            0,
            0,
            [],
        )
        maturities = [a[1] for a in portfolio]

        (notionals, localFromLiquidator, fCashContext) = liquidation.liquidatefCashLocal(
            accounts[0], 1, maturities, [10e8, 200e8], fCashContext, START_TIME
        )
        localCashBalanceUnderlyingAfter = fCashContext[3]
        underlyingBenefitRequired = fCashContext[4]

        assert localCashBalanceUnderlyingAfter == localCashBalanceUnderlying + localFromLiquidator
        assert underlyingBenefitRequired > 10
        assert localCashBalanceUnderlyingAfter > 0
        assert notionals == [-10e8, -200e8]
        assert sum(notionals) < localFromLiquidator

    def test_liquidate_negative_and_positive_fcash(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        localCashBalanceUnderlying = 100e8
        portfolio = [
            get_fcash_token(1, currencyId=1, notional=1000e8),
            get_fcash_token(2, currencyId=1, notional=-1000e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(1)
        factors = (
            accounts[0],
            -1e8,
            -1e8,
            0,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (
            accountContext,
            factors,
            portfolioState,
            localCashBalanceUnderlying,
            0,
            0,
            0,
            [],
        )
        maturities = [a[1] for a in portfolio]

        (notionals, localFromLiquidator, fCashContext) = liquidation.liquidatefCashLocal(
            accounts[0], 1, maturities, [0, 0], fCashContext, START_TIME
        )
        localCashBalanceUnderlyingAfter = fCashContext[3]
        underlyingBenefitRequired = fCashContext[4]

        assert localCashBalanceUnderlyingAfter == localCashBalanceUnderlying + localFromLiquidator
        assert localCashBalanceUnderlyingAfter > 0
        assert underlyingBenefitRequired < 10
        assert sum(notionals) < localFromLiquidator

    def test_liquidate_fcash_cross_currency_no_collateral_available_failure(
        self, liquidation, accounts
    ):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(2, SETTLEMENT_DATE, m)

        portfolio = [
            get_fcash_token(1, currencyId=2, notional=-101e8),
            get_fcash_token(2, currencyId=2, notional=1e8),
        ]

        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(2)
        factors = (
            accounts[0],
            -100e8,
            -200e8,
            -100e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )
        fCashContext = (accountContext, factors, portfolioState, 0, 0, 0, 0, [])
        maturities = [portfolio[1][1]]

        with brownie.reverts():
            liquidation.liquidatefCashCrossCurrency(
                accounts[0], 2, maturities, [0], fCashContext, START_TIME
            )

    def test_liquidate_fcash_cross_currency_no_local_debt(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(2, SETTLEMENT_DATE, m)

        portfolio = [
            get_fcash_token(1, currencyId=2, notional=-101e8),
            get_fcash_token(2, currencyId=2, notional=1e8),
        ]

        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(2)
        factors = (
            accounts[0],
            -100e8,
            200e8,
            -100e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )
        fCashContext = (accountContext, factors, portfolioState, 0, 0, 0, 0, [])
        maturities = [portfolio[1][1]]

        with brownie.reverts():
            liquidation.liquidatefCashCrossCurrency(
                accounts[0], 2, maturities, [0], fCashContext, START_TIME
            )

    def test_liquidate_fcash_cross_currency_cannot_liquidate_negative(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(2, SETTLEMENT_DATE, m)

        portfolio = [
            get_fcash_token(1, currencyId=2, notional=50000e8),
            get_fcash_token(2, currencyId=2, notional=-1e8),
            get_fcash_token(3, currencyId=2, notional=100000e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(2)
        factors = (
            accounts[0],
            -100e8,
            -200e8,
            150000e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )
        fCashContext = (accountContext, factors, portfolioState, 0, 0, 0, 0, [])
        maturities = [portfolio[1][1]]

        with brownie.reverts():
            liquidation.liquidatefCashCrossCurrency(
                accounts[0], 2, maturities, [0], fCashContext, START_TIME
            )

    def test_liquidate_fcash_cross_currency_local_available_limit(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(2, SETTLEMENT_DATE, m)

        portfolio = [
            get_fcash_token(1, currencyId=2, notional=50000e8),
            get_fcash_token(2, currencyId=2, notional=50000e8),
            get_fcash_token(3, currencyId=2, notional=50000e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(2)
        factors = (
            accounts[0],
            -100e8,
            -200e8,
            150000e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (accountContext, factors, portfolioState, 0, 0, 0, 0, [])
        maturities = [a[1] for a in portfolio]

        (notionals, localFromLiquidator, _) = liquidation.liquidatefCashCrossCurrency(
            accounts[0], 2, maturities, [0, 0, 0], fCashContext, START_TIME
        )

        assert sum(notionals) > localFromLiquidator
        assert localFromLiquidator == 200e8
        # Assert that it stops at the first fcash asset
        assert notionals[1] == 0
        assert notionals[2] == 0

    def test_liquidate_fcash_cross_currency_collateral_available_limit(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(2, SETTLEMENT_DATE, m)

        portfolio = [
            get_fcash_token(1, currencyId=2, notional=200e8),
            get_fcash_token(2, currencyId=2, notional=-50e8),
        ]
        liquidation.setPortfolio(accounts[0], portfolio)
        liquidation.setBalance(accounts[0], 1, -1000e8, 0)
        (accountContext, factors, portfolioState) = liquidation.preLiquidationActions(
            accounts[0], 1, 2, {"from": accounts[1]}
        ).return_value

        fCashContext = (accountContext, factors, portfolioState, 0, 0, 0, 0, [])
        maturities = [portfolio[0][1]]

        (notionals, localFromLiquidator, _) = liquidation.liquidatefCashCrossCurrency(
            accounts[0], 2, maturities, [0, 0, 0], fCashContext, START_TIME
        )

        asset = list(portfolio[0])
        asset[3] -= notionals[0]
        portfolio[0] = tuple(asset)
        liquidation.clearPortfolio(accounts[0])
        liquidation.setPortfolio(accounts[0], portfolio)
        (_, netLocal) = liquidation.fc(accounts[0])

        assert sum(notionals) > localFromLiquidator
        # Collateral available should be close to zero here
        assert pytest.approx(netLocal[1], abs=0.01e8) == 0

    def test_liquidate_fcash_cross_currency_maximum_amount(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(2, SETTLEMENT_DATE, m)

        portfolio = [
            get_fcash_token(1, currencyId=2, notional=100e8),
            get_fcash_token(2, currencyId=2, notional=100e8),
            get_fcash_token(3, currencyId=2, notional=100e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(2)
        factors = (
            accounts[0],
            -500e8,
            -500e8,
            300e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (accountContext, factors, portfolioState, 0, 0, 0, 0, [])
        maturities = [a[1] for a in portfolio]

        (notionals, localFromLiquidator, _) = liquidation.liquidatefCashCrossCurrency(
            accounts[0], 2, maturities, [0, 0, 0], fCashContext, START_TIME
        )

        assert sum(notionals) > localFromLiquidator
        assert notionals == [100e8, 100e8, 100e8]

    def test_liquidate_fcash_cross_currency_user_specified_maximum(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(2, SETTLEMENT_DATE, m)

        portfolio = [
            get_fcash_token(1, currencyId=2, notional=100e8),
            get_fcash_token(2, currencyId=2, notional=100e8),
            get_fcash_token(3, currencyId=2, notional=100e8),
        ]
        portfolioState = (portfolio, [], 0, len(portfolio))
        accountContext = (START_TIME, "0x01", 3, 0, "0x000000000000000000")
        cashGroup = liquidation.buildCashGroupView(2)
        factors = (
            accounts[0],
            -500e8,
            -500e8,
            300e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (accountContext, factors, portfolioState, 0, 0, 0, 0, [])
        maturities = [a[1] for a in portfolio]

        (notionals, localFromLiquidator, _) = liquidation.liquidatefCashCrossCurrency(
            accounts[0], 2, maturities, [20e8, 20e8, 20e8], fCashContext, START_TIME
        )

        assert sum(notionals) > localFromLiquidator
        assert notionals == [20e8, 20e8, 20e8]

    def test_liquidate_fcash_bitmap_portfolio(self, liquidation, accounts):
        # This test liquidates all positive fCash
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        accountContext = (START_TIME, "0x01", 0, 1, "0x000000000000000000")
        liquidation.setBitmapAsset(accounts[0], 1, START_TIME, markets[0][1], 100e8)
        liquidation.setBitmapAsset(accounts[0], 1, START_TIME, markets[1][1], 100e8)
        cashGroup = liquidation.buildCashGroupView(1)
        factors = (
            accounts[0],
            -10.1e8,
            1000e8,
            1000e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        fCashContext = (accountContext, factors, ([], [], 0, 0), 0, 0, 0, 0, [])
        maturities = [markets[0][1], markets[1][1]]
        maxAmounts = [0] * len(maturities)

        (notionals, localFromLiquidator, _) = liquidation.liquidatefCashLocal(
            accounts[0], 1, maturities, maxAmounts, fCashContext, START_TIME
        )

        assert sum(notionals) > localFromLiquidator
        assert notionals == [100e8, 100e8]
