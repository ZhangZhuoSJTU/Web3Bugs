import pytest
from brownie.network.state import Chain
from brownie.test import given, strategy
from tests.constants import START_TIME
from tests.helpers import get_balance_state, get_cash_group_with_max_markets, get_eth_rate_mapping

chain = Chain()

EMPTY_PORTFOLIO_STATE = ([], [], 0, 0)


@pytest.mark.liquidation
class TestLiquidateLocalNTokens:
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
        MockLocalLiquidationOverride,
        MockLiquidationSetup,
        SettleAssetsExternal,
        FreeCollateralExternal,
        MockCToken,
        cTokenAggregator,
        ethAggregators,
        accounts,
    ):
        SettleAssetsExternal.deploy({"from": accounts[0]})
        FreeCollateralExternal.deploy({"from": accounts[0]})

        liquidateOverride = accounts[0].deploy(MockLocalLiquidationOverride)
        liquidateSetup = accounts[0].deploy(MockLiquidationSetup)
        ctoken = accounts[0].deploy(MockCToken, 8)
        # This is the identity rate
        ctoken.setAnswer(1e18)
        aggregator = cTokenAggregator.deploy(ctoken.address, {"from": accounts[0]})

        rateStorage = (aggregator.address, 8)
        ethAggregators[0].setAnswer(1e18)
        cg = get_cash_group_with_max_markets(3)
        liquidateOverride.setAssetRateMapping(1, rateStorage)
        liquidateSetup.setAssetRateMapping(1, rateStorage)
        liquidateOverride.setCashGroup(1, cg)
        liquidateSetup.setCashGroup(1, cg)
        liquidateOverride.setETHRateMapping(
            1, get_eth_rate_mapping(ethAggregators[0], discount=104)
        )
        liquidateSetup.setETHRateMapping(1, get_eth_rate_mapping(ethAggregators[0], discount=104))

        chain.mine(1, timestamp=START_TIME)

        return (liquidateOverride, liquidateSetup)

    @given(localAvailable=strategy("int", min_value=-1000e8, max_value=-1e8))
    def test_liquidate_ntoken_no_limit(self, liquidation, accounts, localAvailable):
        (liquidateOverride, _) = liquidation
        cashGroup = liquidateOverride.buildCashGroupView(1)
        nTokenBalance = 10000e8

        factors = (
            accounts[0],
            localAvailable,
            localAvailable,
            0,
            nTokenBalance * 0.90,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (0, 0, 0, 0, 0),
            cashGroup[2],
            cashGroup,
            [],
        )

        (
            balanceState,
            netLocalFromLiquidator,
            markets,
        ) = liquidateOverride.liquidateLocalCurrencyOverride(
            1,
            0,
            START_TIME,
            get_balance_state(
                1, storedCashBalance=localAvailable, storedNTokenBalance=nTokenBalance
            ),
            factors,
        )

        # allowed to purchase up to 40% of 1100
        assert balanceState[5] == -(nTokenBalance * 0.40)
        assert netLocalFromLiquidator == (nTokenBalance * 0.40 * 0.95)

    @given(nTokenValue=strategy("int", min_value=1e8, max_value=400e8))
    def test_liquidate_ntoken_more_than_limit(self, liquidation, accounts, nTokenValue):
        (liquidateOverride, _) = liquidation
        cashGroup = liquidateOverride.buildCashGroupView(1)
        nTokenBalance = int(nTokenValue / 0.90)

        factors = (
            accounts[0],
            -1000000e8,
            -1000e8,
            0,
            nTokenValue,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (0, 0, 0, 0, 0),
            cashGroup[2],
            cashGroup,
            [],
        )

        (
            balanceState,
            netLocalFromLiquidator,
            markets,
        ) = liquidateOverride.liquidateLocalCurrencyOverride(
            1,
            0,
            START_TIME,
            get_balance_state(1, storedCashBalance=-1000e8, storedNTokenBalance=nTokenBalance),
            factors,
        )

        # allowed to purchase up to 100% of token balance
        assert -balanceState[5] <= nTokenBalance
        assert pytest.approx(netLocalFromLiquidator, abs=2) == (-balanceState[5] * 0.95)

    def test_liquidate_ntoken_limit_to_user_specification(self, liquidation, accounts):
        (liquidateOverride, _) = liquidation
        cashGroup = liquidateOverride.buildCashGroupView(1)

        factors = (
            accounts[0],
            -1000000e8,
            -100e8,
            0,
            99e8,
            "0x5F00005A0000",  # 95 liquidation, 90 haircut
            (1e18, 1e18, 140, 100, 106),
            (0, 0, 0, 0, 0),
            cashGroup[2],
            cashGroup,
            [],
        )

        (
            balanceState,
            netLocalFromLiquidator,
            markets,
        ) = liquidateOverride.liquidateLocalCurrencyOverride(
            1,
            10e8,
            START_TIME,
            get_balance_state(1, storedCashBalance=-100e8, storedNTokenBalance=110e8),
            factors,
        )

        # allowed to purchase up to 100% of 110
        assert balanceState[5] == -10e8
        assert netLocalFromLiquidator == (10e8 * 0.95)
