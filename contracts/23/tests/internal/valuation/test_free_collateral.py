import pytest
from brownie.network.state import Chain
from tests.constants import (
    HAS_ASSET_DEBT,
    HAS_CASH_DEBT,
    SECONDS_IN_DAY,
    SETTLEMENT_DATE,
    START_TIME,
)
from tests.helpers import (
    get_cash_group_with_max_markets,
    get_eth_rate_mapping,
    get_fcash_token,
    get_market_curve,
)

chain = Chain()


@pytest.mark.valuation
class TestFreeCollateral:
    @pytest.fixture(scope="module", autouse=True)
    def ethAggregators(self, MockAggregator, accounts):
        return [
            MockAggregator.deploy(18, {"from": accounts[0]}),
            MockAggregator.deploy(18, {"from": accounts[0]}),
            MockAggregator.deploy(18, {"from": accounts[0]}),
            MockAggregator.deploy(18, {"from": accounts[0]}),
        ]

    @pytest.fixture(scope="module", autouse=True)
    def freeCollateral(
        self,
        MockFreeCollateral,
        SettleAssetsExternal,
        MockCToken,
        cTokenAggregator,
        FreeCollateralExternal,
        ethAggregators,
        accounts,
    ):
        fc = accounts[0].deploy(MockFreeCollateral)
        cETH = accounts[0].deploy(MockCToken, 8)
        cETH.setAnswer(200000000000000000000000000)
        ethAgg = cTokenAggregator.deploy(cETH.address, {"from": accounts[0]})

        fc.setAssetRateMapping(1, (ethAgg.address, 18))
        cg = get_cash_group_with_max_markets(3)
        fc.setCashGroup(1, cg)
        # This is ETH, always 1-1
        ethAggregators[0].setAnswer(1e18)
        fc.setETHRateMapping(1, get_eth_rate_mapping(ethAggregators[0]))

        cUSDC = accounts[0].deploy(MockCToken, 8)
        cUSDC.setAnswer(200000000000000)
        usdcAgg = cTokenAggregator.deploy(cUSDC.address, {"from": accounts[0]})

        fc.setAssetRateMapping(2, (usdcAgg.address, 6))
        fc.setCashGroup(2, cg)
        ethAggregators[1].setAnswer(0.01e18)
        fc.setETHRateMapping(2, get_eth_rate_mapping(ethAggregators[1], haircut=80))

        cToken = accounts[0].deploy(MockCToken, 8)
        cToken.setAnswer(20000000000000000)
        tokenAgg = cTokenAggregator.deploy(cToken.address, {"from": accounts[0]})

        fc.setAssetRateMapping(3, (tokenAgg.address, 8))
        fc.setCashGroup(3, cg)
        ethAggregators[2].setAnswer(0.1e18)
        fc.setETHRateMapping(3, get_eth_rate_mapping(ethAggregators[2], haircut=0))

        fc.setAssetRateMapping(4, (tokenAgg.address, 8))
        fc.setCashGroup(4, cg)
        ethAggregators[3].setAnswer(10e18)
        fc.setETHRateMapping(4, get_eth_rate_mapping(ethAggregators[3]))

        chain.mine(1, timestamp=START_TIME)

        return fc

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    # cash balance haircuts
    def test_cash_balance_no_haircut(self, freeCollateral, accounts):
        freeCollateral.setBalance(accounts[0], 1, 50e8, 0)
        (fc, netLocal) = freeCollateral.testFreeCollateral(accounts[0], START_TIME).return_value
        assert fc == 1e8
        assert netLocal[0] == 50e8

    def test_cash_balance_haircut(self, freeCollateral, accounts):
        freeCollateral.setBalance(accounts[0], 2, 5000e8, 0)
        (fc, netLocal) = freeCollateral.testFreeCollateral(accounts[0], START_TIME).return_value
        assert fc == 0.8e8
        assert netLocal[0] == 5000e8

    def test_cash_balance_full_haircut(self, freeCollateral, accounts):
        freeCollateral.setBalance(accounts[0], 3, 5000e8, 0)
        (fc, netLocal) = freeCollateral.testFreeCollateral(accounts[0], START_TIME).return_value
        assert fc == 0
        assert netLocal[0] == 5000e8

    # cash balance debt buffers
    def test_cash_balance_debt(self, freeCollateral, accounts):
        freeCollateral.setBalance(accounts[0], 1, -50e8, 0)
        (fc, netLocal) = freeCollateral.testFreeCollateral(accounts[0], START_TIME).return_value
        assert fc == -1.40e8
        assert netLocal[0] == -50e8

    def test_portfolio_fCash_no_haircut(self, freeCollateral, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            freeCollateral.setMarketStorage(1, SETTLEMENT_DATE, m)

        freeCollateral.setPortfolio(accounts[0], [get_fcash_token(1, notional=100e8)])
        (fc, netLocal) = freeCollateral.testFreeCollateral(accounts[0], START_TIME).return_value
        assert fc > 95e8 and fc < 100e8
        assert netLocal[0] == fc * 50

    def test_portfolio_fCash_haircut(self, freeCollateral, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            freeCollateral.setMarketStorage(2, SETTLEMENT_DATE, m)

        freeCollateral.setPortfolio(accounts[0], [get_fcash_token(1, currencyId=2, notional=100e8)])
        (fc, netLocal) = freeCollateral.testFreeCollateral(accounts[0], START_TIME).return_value
        assert fc > 0.75e8 and fc < 0.80e8
        assert netLocal[0] > 50 * 100e8 * 0.95

    def test_portfolio_fCash_full_haircut(self, freeCollateral, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            freeCollateral.setMarketStorage(3, SETTLEMENT_DATE, m)

        freeCollateral.setPortfolio(accounts[0], [get_fcash_token(1, currencyId=3, notional=100e8)])
        (fc, netLocal) = freeCollateral.testFreeCollateral(accounts[0], START_TIME).return_value
        assert fc == 0
        assert netLocal[0] > 50 * 100e8 * 0.95

    def test_portfolio_debt(self, freeCollateral, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            freeCollateral.setMarketStorage(3, SETTLEMENT_DATE, m)

        freeCollateral.setPortfolio(
            accounts[0], [get_fcash_token(1, currencyId=3, notional=-100e8)]
        )
        (fc, netLocal) = freeCollateral.testFreeCollateral(accounts[0], START_TIME).return_value
        assert fc > -14.0e8 and fc < -13.0e8
        assert netLocal[0] < 50 * -100e8 * 0.95

    def test_local_collateral_netting(self, freeCollateral, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            freeCollateral.setMarketStorage(3, SETTLEMENT_DATE, m)
        freeCollateral.setPortfolio(
            accounts[0], [get_fcash_token(1, currencyId=3, notional=-105e8)]
        )
        freeCollateral.setBalance(accounts[0], 3, 5000e8, 0)
        (fc, netLocal) = freeCollateral.testFreeCollateral(accounts[0], START_TIME).return_value
        assert fc > -5e8 * 1.4
        assert netLocal[0] < 50 * -5e8 * 0.95

    def test_bitmap_has_debt(self, freeCollateral, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            freeCollateral.setMarketStorage(1, SETTLEMENT_DATE, m)

        freeCollateral.enableBitmapForAccount(accounts[0], 1, START_TIME)
        freeCollateral.setifCashAsset(
            accounts[0], 1, markets[0][1] + SECONDS_IN_DAY * 5, -100e8, START_TIME
        )
        freeCollateral.setifCashAsset(
            accounts[0], 1, markets[0][1] + SECONDS_IN_DAY * 10, 1e8, START_TIME
        )

        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == HAS_ASSET_DEBT

        txn = freeCollateral.testFreeCollateral(accounts[0], START_TIME)
        (fc, netLocal) = txn.return_value
        assert fc < -138e8
        liquidation = txn.events["Liquidation"]["factors"]
        assert liquidation[1] == fc
        assert liquidation[2] == netLocal[0]

        freeCollateral.setBalance(accounts[0], 1, 5000e8, 0)
        (fc, netLocal) = freeCollateral.testFreeCollateral(accounts[0], START_TIME).return_value
        assert fc > 0
        assert netLocal[0] > 0

        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == HAS_ASSET_DEBT

    def test_bitmap_remove_debt(self, freeCollateral, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            freeCollateral.setMarketStorage(1, SETTLEMENT_DATE, m)

        freeCollateral.enableBitmapForAccount(accounts[0], 1, START_TIME)
        freeCollateral.setifCashAsset(
            accounts[0], 1, markets[0][1] + SECONDS_IN_DAY * 5, -100e8, START_TIME
        )
        freeCollateral.setBalance(accounts[0], 1, 200e8, 0)
        freeCollateral.testFreeCollateral(accounts[0], START_TIME)

        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == HAS_ASSET_DEBT

        freeCollateral.setifCashAsset(
            accounts[0], 1, markets[0][1] + SECONDS_IN_DAY * 10, 200e8, START_TIME
        )
        freeCollateral.testFreeCollateral(accounts[0], START_TIME)
        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == HAS_ASSET_DEBT

        # Net off asset debt
        freeCollateral.setifCashAsset(
            accounts[0], 1, markets[0][1] + SECONDS_IN_DAY * 5, 100e8, START_TIME
        )
        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == HAS_ASSET_DEBT

        txn = freeCollateral.testFreeCollateral(accounts[0], START_TIME)
        assert txn.events["AccountContextUpdate"]
        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == "0x00"  # no debt

    def test_remove_cash_debt(self, freeCollateral, accounts):
        freeCollateral.setBalance(accounts[0], 1, -200e8, 0)
        freeCollateral.setBalance(accounts[0], 2, 400e8, 0)
        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == HAS_CASH_DEBT

        # Account still has cash debt, must not change setting
        freeCollateral.testFreeCollateral(accounts[0], START_TIME)
        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == HAS_CASH_DEBT

        freeCollateral.setBalance(accounts[0], 1, 0, 0)
        context = freeCollateral.getAccountContext(accounts[0])
        # Cash debt setting is still temporarily on
        assert context[1] == HAS_CASH_DEBT

        txn = freeCollateral.testFreeCollateral(accounts[0], START_TIME)
        assert txn.events["AccountContextUpdate"]
        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == "0x00"  # no debt

    @pytest.mark.skip_coverage
    def test_remove_cash_debt_bitmap_currency(self, freeCollateral, accounts):
        freeCollateral.enableBitmapForAccount(accounts[0], 1, START_TIME)
        freeCollateral.setBalance(accounts[0], 1, -200e8, 0)
        freeCollateral.setBalance(accounts[0], 2, 400e8, 0)
        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == HAS_CASH_DEBT

        # Account still has cash debt, must not change setting
        freeCollateral.testFreeCollateral(accounts[0], START_TIME)
        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == HAS_CASH_DEBT

        freeCollateral.setBalance(accounts[0], 1, 0, 0)
        context = freeCollateral.getAccountContext(accounts[0])
        # Cash debt setting is still temporarily on
        assert context[1] == HAS_CASH_DEBT

        txn = freeCollateral.testFreeCollateral(accounts[0], START_TIME)
        assert txn.events["AccountContextUpdate"]
        context = freeCollateral.getAccountContext(accounts[0])
        assert context[1] == "0x00"  # no debt

    @pytest.mark.skip_coverage
    def test_free_collateral_multiple_cash_groups(self, freeCollateral, accounts):
        markets = get_market_curve(3, "flat")
        for m in markets:
            freeCollateral.setMarketStorage(1, SETTLEMENT_DATE, m)
            freeCollateral.setMarketStorage(2, SETTLEMENT_DATE, m)
            freeCollateral.setMarketStorage(3, SETTLEMENT_DATE, m)

        freeCollateral.setPortfolio(
            accounts[0],
            [
                get_fcash_token(1, currencyId=2, notional=100e8),
                get_fcash_token(1, currencyId=1, notional=-1e8),
                get_fcash_token(1, currencyId=3, notional=100e8),
            ],
        )
        freeCollateral.testFreeCollateral(accounts[0], START_TIME)
        (fc, netLocal) = freeCollateral.freeCollateralView(accounts[0], START_TIME)
        assert netLocal[0] < 50e8
        assert netLocal[1] < 5000e8
        assert netLocal[2] < 5000e8
        assert pytest.approx(fc, rel=1e-3) == -(1e8 * 1.4 - 0.80e8)

    # def test_free_collateral_ntoken_value(self, freeCollateral, accounts):
    # def test_free_collateral_combined(self, freeCollateral):
