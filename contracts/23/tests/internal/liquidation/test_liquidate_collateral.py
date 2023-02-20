import math

import pytest
from brownie.network.state import Chain
from tests.constants import SETTLEMENT_DATE, START_TIME
from tests.helpers import (
    get_balance_state,
    get_cash_group_with_max_markets,
    get_eth_rate_mapping,
    get_fcash_token,
    get_liquidity_token,
    get_market_curve,
)

chain = Chain()


@pytest.mark.liquidation
class TestLiquidateCollateral:
    @pytest.fixture(scope="module", autouse=True)
    def ethAggregators(self, MockAggregator, accounts):
        return [
            MockAggregator.deploy(18, {"from": accounts[0]}),
            MockAggregator.deploy(18, {"from": accounts[0]}),
            MockAggregator.deploy(18, {"from": accounts[0]}),
        ]

    @pytest.fixture(scope="module", autouse=True)
    def liquidation(
        self, MockCollateralLiquidation, MockCToken, cTokenAggregator, ethAggregators, accounts
    ):
        liquidateCollateral = accounts[0].deploy(MockCollateralLiquidation)
        ctoken = accounts[0].deploy(MockCToken, 8)
        # This is the identity rate
        ctoken.setAnswer(1e18)
        aggregator = cTokenAggregator.deploy(ctoken.address, {"from": accounts[0]})

        cg = get_cash_group_with_max_markets(3)
        rateStorage = (aggregator.address, 8)

        ethAggregators[0].setAnswer(1e18)
        liquidateCollateral.setAssetRateMapping(1, rateStorage)
        liquidateCollateral.setCashGroup(1, cg)
        liquidateCollateral.setETHRateMapping(
            1, get_eth_rate_mapping(ethAggregators[0], discount=104)
        )

        ethAggregators[1].setAnswer(1e18)
        liquidateCollateral.setAssetRateMapping(2, rateStorage)
        liquidateCollateral.setCashGroup(2, cg)
        liquidateCollateral.setETHRateMapping(
            2, get_eth_rate_mapping(ethAggregators[1], discount=102)
        )

        ethAggregators[2].setAnswer(1e18)
        liquidateCollateral.setAssetRateMapping(3, rateStorage)
        liquidateCollateral.setCashGroup(3, cg)
        liquidateCollateral.setETHRateMapping(
            3, get_eth_rate_mapping(ethAggregators[2], discount=105)
        )

        chain.mine(1, timestamp=START_TIME)

        return liquidateCollateral

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    # Test liquidate collateral cash balance
    def test_over_max_collateral_amount(self, liquidation, accounts):
        # Allow liquidation over 40% amount when required
        collateralBalance = 500e8

        portfolioState = ([], [], 0, 0)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -1000e8,  # Significantly undercollateralized
            -1000e8,
            106e8,  # Allow purchase of 100%
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        discount = max(factors[6][-1], factors[7][-1])
        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            _,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=collateralBalance),
            factors,
            portfolioState,
            0,
            0,
            START_TIME,
        )

        assert portfolioState == newPortfolioState
        assert localFromLiquidator == 100e8
        assert pytest.approx(newBalanceState[3], abs=2) == -math.trunc(
            localFromLiquidator * discount / 100
        )
        assert newBalanceState[5] == 0

    def test_limited_by_max_collateral_amount(self, liquidation, accounts):
        # Allow liquidation up to 40% of collateral amount
        collateralBalance = 500e8

        portfolioState = ([], [], 0, 0)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -10e8,  # Only slightly undercollateralized
            -1000e8,
            132.5e8,  # But we allow purchasing up to 40% of this
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        discount = max(factors[6][-1], factors[7][-1])
        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            _,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=collateralBalance),
            factors,
            portfolioState,
            0,
            0,
            START_TIME,
        )

        assert portfolioState == newPortfolioState
        assert localFromLiquidator == 50e8
        assert pytest.approx(newBalanceState[3], abs=2) == -math.trunc(
            localFromLiquidator * discount / 100
        )
        assert newBalanceState[5] == 0

    def test_limited_by_user_specification(self, liquidation, accounts):
        # Do not liquidate more than what the user has specified in max collateral
        collateralBalance = 500e8

        portfolioState = ([], [], 0, 0)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -100e8,
            -100e8,
            500e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        discount = max(factors[6][-1], factors[7][-1])
        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            _,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=collateralBalance),
            factors,
            portfolioState,
            53e8,  # Specification is here
            0,
            START_TIME,
        )

        assert portfolioState == newPortfolioState
        assert localFromLiquidator == 50e8
        assert pytest.approx(newBalanceState[3], abs=2) == -math.trunc(
            localFromLiquidator * discount / 100
        )
        assert newBalanceState[5] == 0

    def test_limited_by_collateral_cash_balance(self, liquidation, accounts):
        # Do not liquidate more than cash balance
        collateralBalance = 53e8

        portfolioState = ([], [], 0, 0)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -100e8,
            -100e8,
            500e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        discount = max(factors[6][-1], factors[7][-1])
        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            _,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=collateralBalance),
            factors,
            portfolioState,
            0,
            0,
            START_TIME,
        )

        assert portfolioState == newPortfolioState
        assert localFromLiquidator == 50e8
        assert pytest.approx(newBalanceState[3], abs=2) == -math.trunc(
            localFromLiquidator * discount / 100
        )
        assert newBalanceState[5] == 0

    def test_limited_by_collateral_available(self, liquidation, accounts):
        # Do not liquidate more collateral available
        collateralBalance = 500e8

        portfolioState = ([], [], 0, 0)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -100e8,
            -100e8,
            53e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        discount = max(factors[6][-1], factors[7][-1])
        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            _,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=collateralBalance),
            factors,
            portfolioState,
            0,
            0,
            START_TIME,
        )

        assert portfolioState == newPortfolioState
        assert localFromLiquidator == 50e8
        assert pytest.approx(newBalanceState[3], abs=2) == -math.trunc(
            localFromLiquidator * discount / 100
        )
        assert newBalanceState[5] == 0

    def test_limited_by_local_available(self, liquidation, accounts):
        # Do not liquidate more collateral than required to get up to -localAvailable
        localBalance = -100e8
        collateralBalance = 500e8

        portfolioState = ([], [], 0, 0)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -100e8,
            -100e8,
            500e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        discount = max(factors[6][-1], factors[7][-1])
        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            _,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=collateralBalance),
            factors,
            portfolioState,
            0,
            0,
            START_TIME,
        )

        assert portfolioState == newPortfolioState
        assert localFromLiquidator == -localBalance
        assert pytest.approx(newBalanceState[3], abs=2) == -math.trunc(
            localFromLiquidator * discount / 100
        )
        assert newBalanceState[5] == 0

    def test_ntokens_suffcient_amount(self, liquidation, accounts):
        # Liquidate part of ntokens up to what is required
        cashBalance = 0
        nTokenBalance = 1000e8
        nTokenValue = 900e8  # This is haircut at 90%

        portfolioState = ([], [], 0, 0)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -100e8,
            -100e8,
            900e8,
            nTokenValue,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            _,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=cashBalance, storedNTokenBalance=nTokenBalance),
            factors,
            portfolioState,
            0,
            0,
            START_TIME,
        )

        assert portfolioState == newPortfolioState
        assert pytest.approx(localFromLiquidator, abs=2) == 100e8
        assert pytest.approx(newBalanceState[3], abs=2) == 0
        assert pytest.approx(newBalanceState[5], abs=2) == -math.trunc(106e8 / 0.95)

    def test_ntokens_limited_by_collateral_specification(self, liquidation, accounts):
        # Liquidate part of ntokens up to what is required
        cashBalance = 0
        nTokenBalance = 1000e8
        nTokenValue = 900e8  # This is haircut at 90%

        portfolioState = ([], [], 0, 0)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -200e8,
            -200e8,
            900e8,
            nTokenValue,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            _,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=cashBalance, storedNTokenBalance=nTokenBalance),
            factors,
            portfolioState,
            106e8,
            0,
            START_TIME,
        )

        assert portfolioState == newPortfolioState
        assert pytest.approx(localFromLiquidator, abs=2) == 100e8
        assert pytest.approx(newBalanceState[3], abs=2) == 0
        assert pytest.approx(newBalanceState[5], abs=2) == -math.trunc(106e8 / 0.95)

    def test_ntokens_limited_by_ntoken_specification(self, liquidation, accounts):
        # Liquidate part of ntokens up to what is required
        cashBalance = 0
        nTokenBalance = 1000e8
        nTokenValue = 900e8  # This is haircut at 90%

        portfolioState = ([], [], 0, 0)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -200e8,
            -200e8,
            900e8,
            nTokenValue,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        discount = max(factors[6][-1], factors[7][-1])
        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            _,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=cashBalance, storedNTokenBalance=nTokenBalance),
            factors,
            portfolioState,
            0,
            100e8,
            START_TIME,
        )

        assert portfolioState == newPortfolioState
        assert pytest.approx(localFromLiquidator, abs=2) == math.trunc(
            (100e8 * 0.95) / discount * 100
        )
        assert pytest.approx(newBalanceState[3], abs=2) == 0
        assert pytest.approx(newBalanceState[5], abs=2) == -100e8

    def test_ntokens_limited_by_balance(self, liquidation, accounts):
        # Liquidate part of ntokens up to what is required
        cashBalance = 0
        nTokenBalance = 100e8
        nTokenValue = 90e8  # This is haircut at 90%

        portfolioState = ([], [], 0, 0)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -200e8,
            -200e8,
            1000e8,
            nTokenValue,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        discount = max(factors[6][-1], factors[7][-1])
        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            _,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=cashBalance, storedNTokenBalance=nTokenBalance),
            factors,
            portfolioState,
            0,
            0,
            START_TIME,
        )

        assert portfolioState == newPortfolioState
        assert pytest.approx(localFromLiquidator, abs=2) == math.trunc(
            ((100e8 * 0.95) / discount) * 100
        )
        assert pytest.approx(newBalanceState[3], abs=2) == 0
        assert pytest.approx(newBalanceState[5], abs=2) == -100e8

    def test_ntokens_limited_max_collateral_allowed(self, liquidation, accounts):
        # Liquidate part of ntokens up to what is required
        cashBalance = 0
        nTokenBalance = 1000e8
        nTokenValue = 900e8  # This is haircut at 90%

        portfolioState = ([], [], 0, 0)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -10e8,
            -1000e8,
            1000e8,
            nTokenValue,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        discount = max(factors[6][-1], factors[7][-1])
        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            _,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=cashBalance, storedNTokenBalance=nTokenBalance),
            factors,
            portfolioState,
            0,
            0,
            START_TIME,
        )

        assert portfolioState == newPortfolioState
        assert pytest.approx(localFromLiquidator, abs=2) == math.trunc((400e8 / discount) * 100)
        assert pytest.approx(newBalanceState[3], abs=2) == 0
        # TODO: This overshoots the 40% liquidation allowance
        assert pytest.approx(newBalanceState[5] * 0.95, abs=2) == -400e8

    def test_sufficient_withdraw_liquidity_tokens(self, liquidation, accounts):
        localBalance = -100e8
        collateralBalance = 10e8
        liquidityTokenNotional = 100e8

        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(2, SETTLEMENT_DATE, m)

        fCashClaim = math.trunc(markets[0][2] * liquidityTokenNotional / markets[0][4])
        cashClaim = math.trunc(markets[0][3] * liquidityTokenNotional / markets[0][4])
        portfolio = [
            get_liquidity_token(1, currencyId=2, notional=liquidityTokenNotional),
            get_fcash_token(1, currencyId=2, notional=-fCashClaim),
        ]
        portfolioState = (portfolio, [], 0, 2)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -20e8,
            -100e8,
            110e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        discount = max(factors[6][-1], factors[7][-1])

        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            markets,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2, storedCashBalance=collateralBalance),
            factors,
            portfolioState,
            20e8,  # Cap the withdraw amount so that this is a partial withdraw
            0,
            START_TIME,
        )

        withdrawn = (
            (localFromLiquidator * discount / 100 - collateralBalance)
            * liquidityTokenNotional
            / cashClaim
        )
        newfCashClaim = fCashClaim * withdrawn / liquidityTokenNotional - fCashClaim

        assert localFromLiquidator < -localBalance
        assert newBalanceState[3] == -collateralBalance
        assert newBalanceState[5] == 0
        assert (
            pytest.approx(newPortfolioState[0][0][3], abs=5) == liquidityTokenNotional - withdrawn
        )
        assert pytest.approx(newPortfolioState[0][1][3], abs=5) == newfCashClaim
        assert newPortfolioState[0][0][5] == 1
        assert newPortfolioState[0][1][5] == 1

    def test_not_sufficient_withdraw_liquidity_tokens(self, liquidation, accounts):
        liquidityTokenNotional = 100e8

        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(2, SETTLEMENT_DATE, m)

        cashClaim = math.trunc(markets[0][3] * liquidityTokenNotional / markets[0][4])

        portfolio = [get_liquidity_token(1, currencyId=2, notional=liquidityTokenNotional)]
        portfolioState = (portfolio, [], 0, 1)
        cashGroup = liquidation.buildCashGroupView(2)

        factors = (
            accounts[0],
            -1000e8,
            -1000e8,
            100e8,
            0,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (1e18, 1e18, 140, 100, 105),
            cashGroup[2],
            cashGroup,
            [],
        )

        discount = max(factors[6][-1], factors[7][-1])

        (
            newBalanceState,
            localFromLiquidator,
            newPortfolioState,
            markets,
        ) = liquidation.liquidateCollateralCurrency(
            get_balance_state(2), factors, portfolioState, 0, 0, START_TIME
        )

        assert pytest.approx(localFromLiquidator, abs=2) == cashClaim * 100 / discount
        assert newBalanceState[4] == cashClaim
        assert newBalanceState[5] == 0
        assert newPortfolioState[0][0][5] == 2
