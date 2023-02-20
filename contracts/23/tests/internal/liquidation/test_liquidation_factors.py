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

chain = Chain()


@pytest.mark.liquidation
class TestLiquidationFactors:
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
        liq = accounts[0].deploy(MockLiquidationSetup)
        ctoken = accounts[0].deploy(MockCToken, 8)
        # This is the identity rate
        ctoken.setAnswer(1e18)
        aggregator = cTokenAggregator.deploy(ctoken.address, {"from": accounts[0]})

        rateStorage = (aggregator.address, 8)
        liq.setAssetRateMapping(1, rateStorage)
        cg = get_cash_group_with_max_markets(3)
        liq.setCashGroup(1, cg)
        ethAggregators[0].setAnswer(1e18)
        liq.setETHRateMapping(1, get_eth_rate_mapping(ethAggregators[0], discount=104))

        liq.setAssetRateMapping(2, rateStorage)
        liq.setCashGroup(2, cg)
        ethAggregators[1].setAnswer(1e18)
        liq.setETHRateMapping(2, get_eth_rate_mapping(ethAggregators[1], discount=102))

        liq.setAssetRateMapping(3, rateStorage)
        liq.setCashGroup(3, cg)
        ethAggregators[2].setAnswer(1e18)
        liq.setETHRateMapping(3, get_eth_rate_mapping(ethAggregators[2], discount=105))

        chain.mine(1, timestamp=START_TIME)

        return liq

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    def test_cannot_liquidate_self(self, liquidation, accounts):
        liquidation.setBalance(accounts[1], 1, -100e8, 0)

        with brownie.reverts():
            liquidation.preLiquidationActions(accounts[0], 1, 2)

    def test_revert_on_sufficient_collateral(self, liquidation, accounts):
        liquidation.setBalance(accounts[1], 1, 100e8, 0)

        with brownie.reverts("Sufficient collateral"):
            liquidation.preLiquidationActions(accounts[1], 1, 2)

        with brownie.reverts("Sufficient collateral"):
            liquidation.preLiquidationActions(accounts[1], 2, 1)

        with brownie.reverts("Sufficient collateral"):
            liquidation.preLiquidationActions(accounts[1], 3, 2)

    def test_revert_on_sufficient_portfolio_value(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        liquidation.setPortfolio(accounts[1], [get_fcash_token(1, notional=100e8)])

        with brownie.reverts("Sufficient collateral"):
            liquidation.preLiquidationActions(accounts[1], 1, 2)

        with brownie.reverts("Sufficient collateral"):
            liquidation.preLiquidationActions(accounts[1], 2, 1)

        with brownie.reverts("Sufficient collateral"):
            liquidation.preLiquidationActions(accounts[1], 3, 2)

    def test_revert_on_invalid_currencies(self, liquidation, accounts):
        with brownie.reverts():
            liquidation.preLiquidationActions(accounts[1], 1, 1)

        with brownie.reverts():
            liquidation.preLiquidationActions(accounts[1], 0, 1)

    def test_asset_factors_local_and_collateral(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        liquidation.setPortfolio(accounts[1], [get_fcash_token(1, notional=-100e8)])
        liquidation.setBalance(accounts[1], 3, 100e8, 0)

        (_, factors, _) = liquidation.preLiquidationActions(accounts[1], 1, 3).return_value

        # Local available
        assert factors[2] > -100e8 and factors[2] < -99e8
        # Collateral available
        assert factors[3] == 100e8
        # Markets unset (collateral has no assets)
        assert len(factors[10]) == 0
        # Cash group unset (collateral has no assets)
        assert factors[9][0] == 0
        # Assert that asset rate is set
        assert factors[9][2][1] != 0

    def test_asset_factors_local_only(self, liquidation, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            liquidation.setMarketStorage(1, SETTLEMENT_DATE, m)

        liquidation.setPortfolio(accounts[1], [get_fcash_token(1, notional=-100e8)])
        liquidation.setBalance(accounts[1], 1, 10e8, 0)

        (_, factors, _) = liquidation.preLiquidationActions(accounts[1], 1, 0).return_value

        # Local available
        assert factors[2] > -90e8 and factors[2] < -89e8
        # Collateral available
        assert factors[3] == 0
        # Cash group set to local
        assert factors[9][0] == 1
