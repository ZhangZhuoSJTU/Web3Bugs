import brownie
import pytest
from brownie import accounts
from brownie.network.state import Chain
from scripts.config import CurrencyDefaults, nTokenDefaults
from tests.constants import RATE_PRECISION, SECONDS_IN_QUARTER
from tests.helpers import get_balance_trade_action, initialize_environment
from tests.stateful.invariants import check_system_invariants

chain = Chain()

# netLocal indexes
ETH = 0
DAI = 1


def transferDAI(environment, accounts):
    for account in accounts[1:]:
        environment.token["DAI"].transfer(account, 100000e18, {"from": accounts[0]})
        environment.token["DAI"].approve(environment.notional.address, 2 ** 255, {"from": account})


@pytest.fixture(scope="module", autouse=True)
def env(accounts):
    environment = initialize_environment(accounts)
    cashGroup = list(environment.notional.getCashGroup(2))
    # Enable the one year market
    cashGroup[0] = 3
    cashGroup[9] = CurrencyDefaults["tokenHaircut"][0:3]
    cashGroup[10] = CurrencyDefaults["rateScalar"][0:3]
    environment.notional.updateCashGroup(2, cashGroup)

    environment.notional.updateDepositParameters(2, [0.4e8, 0.4e8, 0.2e8], [0.8e9, 0.8e9, 0.8e9])

    environment.notional.updateInitializationParameters(
        2, [0.01e9, 0.021e9, 0.07e9], [0.5e9, 0.5e9, 0.5e9]
    )

    blockTime = chain.time()
    chain.mine(1, timestamp=(blockTime + SECONDS_IN_QUARTER))

    environment.notional.initializeMarkets(1, False)
    environment.notional.initializeMarkets(2, False)

    transferDAI(environment, accounts)

    return environment


@pytest.fixture(scope="module", autouse=True)
def currencyLiquidation(env, accounts):
    borrowAction = get_balance_trade_action(
        2,
        "None",
        [{"tradeActionType": "Borrow", "marketIndex": 3, "notional": 100e8, "maxSlippage": 0}],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )
    # account[1]: DAI borrower with ETH cash
    collateral = get_balance_trade_action(1, "DepositUnderlying", [], depositActionAmount=2.5e18)
    env.notional.batchBalanceAndTradeAction(
        accounts[1], [collateral, borrowAction], {"from": accounts[1], "value": 2.5e18}
    )

    # account[2]: DAI borrower with ETH liquidity token collateral (2x)
    collateral = get_balance_trade_action(
        1,
        "DepositUnderlying",
        [
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 1,
                "notional": 37.5e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            },
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 2,
                "notional": 37.5e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            },
        ],
        depositActionAmount=2.5e18,
    )
    env.notional.batchBalanceAndTradeAction(
        accounts[2], [collateral, borrowAction], {"from": accounts[2], "value": 2.5e18}
    )

    # account[3]: DAI borrower with ETH ntoken
    collateral = get_balance_trade_action(
        1, "DepositUnderlyingAndMintNToken", [], depositActionAmount=2.5e18
    )
    env.notional.batchBalanceAndTradeAction(
        accounts[3], [collateral, borrowAction], {"from": accounts[3], "value": 2.5e18}
    )

    # account[4]: DAI borrower with ETH cash, liquidity token, nToken
    collateral = get_balance_trade_action(
        1,
        "DepositUnderlying",
        [
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 1,
                "notional": 12.5e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            },
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 2,
                "notional": 12.5e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            },
        ],
        depositActionAmount=1e18,
    )
    env.notional.batchBalanceAndTradeAction(
        accounts[4], [collateral], {"from": accounts[4], "value": 1e18}
    )

    collateral = get_balance_trade_action(
        1, "DepositUnderlyingAndMintNToken", [], depositActionAmount=1.5e18
    )
    env.notional.batchBalanceAndTradeAction(
        accounts[4], [collateral, borrowAction], {"from": accounts[4], "value": 1.5e18}
    )

    # account[5]: DAI borrower with DAI ntoken
    collateral = get_balance_trade_action(
        2,
        "DepositUnderlyingAndMintNToken",
        [{"tradeActionType": "Borrow", "marketIndex": 3, "notional": 100e8, "maxSlippage": 0}],
        depositActionAmount=120e18,
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )
    env.notional.batchBalanceAndTradeAction(accounts[5], [collateral], {"from": accounts[5]})

    # account[6]: DAI borrower with DAI liquidity token (2x)
    collateral = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 1,
                "notional": 3000e8,  # in asset cash terms
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            },
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 2,
                "notional": 3000e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            },
            {"tradeActionType": "Borrow", "marketIndex": 3, "notional": 100e8, "maxSlippage": 0},
        ],
        depositActionAmount=120e18,
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )
    env.notional.batchBalanceAndTradeAction(accounts[6], [collateral], {"from": accounts[6]})

    return env


@pytest.fixture(scope="module", autouse=True)
def fCashLiquidation(env, accounts):
    borrowAction = get_balance_trade_action(
        2,
        "None",
        [{"tradeActionType": "Borrow", "marketIndex": 3, "notional": 100e8, "maxSlippage": 0}],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )
    # account[0]: liquidator, has sufficient balances

    # account[7]: DAI borrower with ETH fCash collateral (2x)
    collateral = get_balance_trade_action(
        1,
        "DepositUnderlying",
        [
            {"tradeActionType": "Lend", "marketIndex": 1, "notional": 1e8, "minSlippage": 0},
            {"tradeActionType": "Lend", "marketIndex": 2, "notional": 1e8, "minSlippage": 0},
        ],
        depositActionAmount=2e18,
    )

    env.notional.batchBalanceAndTradeAction(
        accounts[7], [collateral, borrowAction], {"from": accounts[7], "value": 2e18}
    )

    # account[8]: DAI borrower with DAI fCash collateral (2x)
    lendBorrowAction = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [
            {"tradeActionType": "Lend", "marketIndex": 1, "notional": 52e8, "minSlippage": 0},
            {"tradeActionType": "Lend", "marketIndex": 2, "notional": 52e8, "minSlippage": 0},
            {"tradeActionType": "Borrow", "marketIndex": 3, "notional": 100e8, "maxSlippage": 0},
        ],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
        depositActionAmount=120e18,
    )

    env.notional.batchBalanceAndTradeAction(accounts[8], [lendBorrowAction], {"from": accounts[8]})

    # account[9]: DAI borrower with DAI fCash and cash collateral (2x)
    lendBorrowAction = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [
            {"tradeActionType": "Borrow", "marketIndex": 3, "notional": 100e8, "maxSlippage": 0},
            {"tradeActionType": "Lend", "marketIndex": 1, "notional": 65e8, "minSlippage": 0},
        ],
        depositActionAmount=9e18,
    )

    env.notional.batchBalanceAndTradeAction(accounts[9], [lendBorrowAction], {"from": accounts[9]})

    return env


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


def check_liquidation_invariants(environment, liquidatedAccount, fcBefore):
    (fc, netLocal) = environment.notional.getFreeCollateral(liquidatedAccount)
    assert fc > fcBefore[0]
    assert fc >= 0

    if len(list(filter(lambda x: x != 0, netLocal))) == 1:
        return

    # Check that availables haven't crossed boundaries for cross currency
    if fcBefore[1][ETH] > 0:
        assert netLocal[ETH] >= 0
    else:
        assert netLocal[ETH] <= 0

    if fcBefore[1][DAI] > 0:
        assert netLocal[DAI] >= 0
    else:
        assert netLocal[DAI] <= 0

    check_system_invariants(environment, accounts)


def move_oracle_rate(environment, marketIndex):
    # TODO: Why am I getting a trade failed liquidity error?
    lend = get_balance_trade_action(
        2,
        "DepositUnderlying",
        [
            {
                "tradeActionType": "Lend",
                "marketIndex": marketIndex,
                "notional": 100000e8,
                "minSlippage": 0,
            }
        ],
        depositActionAmount=100000e18,
    )
    environment.notional.batchBalanceAndTradeAction(accounts[9], [lend], {"from": accounts[9]})


# given different max liquidation amounts
@pytest.mark.liquidation
def test_liquidate_local_currency(currencyLiquidation, accounts):
    # Increase oracle rate
    # marketsBefore = currencyLiquidation.notional.getActiveMarkets(2)
    # nTokenPVBefore = currencyLiquidation.nToken[2].getPresentValueUnderlyingDenominated()
    # move_oracle_rate(currencyLiquidation, 3)
    # marketsAfter = currencyLiquidation.notional.getActiveMarkets(2)
    # nTokenPVAfter = currencyLiquidation.nToken[2].getPresentValueUnderlyingDenominated()

    # Change the governance parameters
    tokenDefaults = nTokenDefaults["Collateral"]
    tokenDefaults[1] = 80
    currencyLiquidation.notional.updateTokenCollateralParameters(2, *(tokenDefaults))

    cashGroup = list(currencyLiquidation.notional.getCashGroup(2))
    cashGroup[9] = [80, 80, 80]
    currencyLiquidation.notional.updateCashGroup(2, cashGroup)

    # liquidate account[5]
    fcBeforeNToken = currencyLiquidation.notional.getFreeCollateral(accounts[5])
    (nTokenNetRequired, _) = currencyLiquidation.notional.calculateLocalCurrencyLiquidation.call(
        accounts[5], 2, 0
    )

    balanceBefore = currencyLiquidation.cToken["DAI"].balanceOf(accounts[0])
    txn = currencyLiquidation.notional.liquidateLocalCurrency(accounts[5], 2, 0)
    assert txn.events["LiquidateLocalCurrency"]
    netLocal = txn.events["LiquidateLocalCurrency"]["netLocalFromLiquidator"]
    balanceAfter = currencyLiquidation.cToken["DAI"].balanceOf(accounts[0])

    assert pytest.approx(netLocal, rel=1e-5) == nTokenNetRequired
    assert balanceBefore - balanceAfter == netLocal
    check_liquidation_invariants(currencyLiquidation, accounts[5], fcBeforeNToken)

    # liquidate account[6]
    fcBeforeLiquidityToken = currencyLiquidation.notional.getFreeCollateral(accounts[6])
    (
        liquidityTokenNetRequired,
        _,
    ) = currencyLiquidation.notional.calculateLocalCurrencyLiquidation.call(accounts[6], 2, 0)

    balanceBefore = currencyLiquidation.cToken["DAI"].balanceOf(accounts[0])
    txn = currencyLiquidation.notional.liquidateLocalCurrency(accounts[6], 2, 0)
    assert txn.events["LiquidateLocalCurrency"]
    netLocal = txn.events["LiquidateLocalCurrency"]["netLocalFromLiquidator"]
    balanceAfter = currencyLiquidation.cToken["DAI"].balanceOf(accounts[0])

    assert pytest.approx(netLocal, rel=1e-5) == liquidityTokenNetRequired
    assert balanceBefore - balanceAfter == netLocal
    check_liquidation_invariants(currencyLiquidation, accounts[6], fcBeforeLiquidityToken)


# given different max liquidation amounts
@pytest.mark.liquidation
def test_liquidate_collateral_currency(currencyLiquidation, accounts):
    # Decrease ETH rate
    currencyLiquidation.ethOracle["DAI"].setAnswer(0.0135e18)

    for account in accounts[1:5]:
        fcBefore = currencyLiquidation.notional.getFreeCollateral(account)
        (
            netLocalCalculated,
            netCashCalculated,
            netNTokenCalculated,
        ) = currencyLiquidation.notional.calculateCollateralCurrencyLiquidation.call(
            account, 2, 1, 0, 0
        )

        balanceBeforeETH = currencyLiquidation.cToken["ETH"].balanceOf(accounts[0])
        balanceBefore = currencyLiquidation.cToken["DAI"].balanceOf(accounts[0])
        balanceBeforeNToken = currencyLiquidation.nToken[1].balanceOf(accounts[0])

        txn = currencyLiquidation.notional.liquidateCollateralCurrency(
            account, 2, 1, 0, 0, True, False
        )
        assert txn.events["LiquidateCollateralCurrency"]
        netLocal = txn.events["LiquidateCollateralCurrency"]["netLocalFromLiquidator"]
        netCash = txn.events["LiquidateCollateralCurrency"]["netCollateralTransfer"]
        netNToken = txn.events["LiquidateCollateralCurrency"]["netNTokenTransfer"]

        balanceAfterETH = currencyLiquidation.cToken["ETH"].balanceOf(accounts[0])
        balanceAfter = currencyLiquidation.cToken["DAI"].balanceOf(accounts[0])
        balanceAfterNToken = currencyLiquidation.nToken[1].balanceOf(accounts[0])

        assert pytest.approx(netLocal, rel=1e-5) == netLocalCalculated
        assert pytest.approx(netCash, rel=1e-5) == netCashCalculated
        assert pytest.approx(netNToken, rel=1e-5) == netNTokenCalculated
        assert balanceBefore - balanceAfter == netLocal
        assert balanceAfterETH - balanceBeforeETH == netCash
        assert balanceAfterNToken - balanceBeforeNToken == netNToken

        check_liquidation_invariants(currencyLiquidation, account, fcBefore)


# given different max liquidation amounts
@pytest.mark.liquidation
def test_liquidate_local_fcash(fCashLiquidation, accounts):
    liquidated = accounts[8]

    # Change the fCash Haircut
    cashGroup = list(fCashLiquidation.notional.getCashGroup(2))
    cashGroup[5] = 250
    fCashLiquidation.notional.updateCashGroup(2, cashGroup)

    fcBefore = fCashLiquidation.notional.getFreeCollateral(liquidated)
    # Get local currency required
    liquidatedPortfolioBefore = fCashLiquidation.notional.getAccountPortfolio(liquidated)
    maturities = [asset[1] for asset in liquidatedPortfolioBefore if asset[3] > 0]
    (
        fCashNotionalCalculated,
        netLocalCalculated,
    ) = fCashLiquidation.notional.calculatefCashLocalLiquidation.call(
        liquidated, 2, maturities, [0, 0]
    )

    balanceBefore = fCashLiquidation.cToken["DAI"].balanceOf(accounts[0])

    txn = fCashLiquidation.notional.liquidatefCashLocal(liquidated, 2, maturities, [0, 0])

    balanceAfter = fCashLiquidation.cToken["DAI"].balanceOf(accounts[0])
    assert txn.events["LiquidatefCashEvent"]
    netLocal = txn.events["LiquidatefCashEvent"]["netLocalFromLiquidator"]
    transfers = txn.events["LiquidatefCashEvent"]["fCashNotionalTransfer"]

    assert pytest.approx(netLocal, rel=1e-5) == netLocalCalculated
    assert pytest.approx(transfers[0], rel=1e-5) == fCashNotionalCalculated[0]
    assert pytest.approx(transfers[1], rel=1e-5) == fCashNotionalCalculated[1]
    assert pytest.approx(balanceBefore - balanceAfter, rel=1e-5) == netLocal

    check_liquidation_invariants(fCashLiquidation, liquidated, fcBefore)


@pytest.mark.liquidation
def test_liquidate_negative_local_fcash(fCashLiquidation, accounts):
    liquidated = accounts[9]

    # Change the fCash Haircut
    cashGroup = list(fCashLiquidation.notional.getCashGroup(2))
    cashGroup[5] = 250
    fCashLiquidation.notional.updateCashGroup(2, cashGroup)

    fcBefore = fCashLiquidation.notional.getFreeCollateral(liquidated)
    # Get local currency required
    liquidatedPortfolioBefore = fCashLiquidation.notional.getAccountPortfolio(liquidated)
    maturities = [asset[1] for asset in liquidatedPortfolioBefore]
    (
        fCashNotionalCalculated,
        netLocalCalculated,
    ) = fCashLiquidation.notional.calculatefCashLocalLiquidation.call(
        liquidated, 2, maturities, [0, 0]
    )

    balanceBefore = fCashLiquidation.cToken["DAI"].balanceOf(accounts[0])

    # TODO: this crashes brownie on the debug trace
    # with brownie.reverts("Insufficient free collateral"):
    #     # Ensures that the FC check will fail due to liquidating only the negative fCash position
    #     fCashLiquidation.notional.liquidatefCashLocal(
    #         liquidated, 2, [maturities[1]], [0], {"from": accounts[11]}
    #     )

    txn = fCashLiquidation.notional.liquidatefCashLocal(liquidated, 2, maturities, [0, 0])

    balanceAfter = fCashLiquidation.cToken["DAI"].balanceOf(accounts[0])
    assert txn.events["LiquidatefCashEvent"]
    netLocal = txn.events["LiquidatefCashEvent"]["netLocalFromLiquidator"]
    transfers = txn.events["LiquidatefCashEvent"]["fCashNotionalTransfer"]

    assert pytest.approx(netLocal, rel=1e-5) == netLocalCalculated
    assert pytest.approx(transfers[0], rel=1e-5) == fCashNotionalCalculated[0]
    assert pytest.approx(transfers[1], rel=1e-5) == fCashNotionalCalculated[1]
    assert pytest.approx(balanceBefore - balanceAfter, rel=1e-5) == netLocal

    check_liquidation_invariants(fCashLiquidation, liquidated, fcBefore)


# given different max liquidation amounts
@pytest.mark.liquidation
def test_liquidate_cross_currency_fcash(fCashLiquidation, accounts):
    # Decrease ETH rate
    liquidated = accounts[7]
    fCashLiquidation.ethOracle["DAI"].setAnswer(0.017e18)
    fcBefore = fCashLiquidation.notional.getFreeCollateral(liquidated)
    # Get local currency required
    liquidatedPortfolioBefore = fCashLiquidation.notional.getAccountPortfolio(liquidated)
    maturities = [asset[1] for asset in liquidatedPortfolioBefore]
    (
        fCashNotionalCalculated,
        netLocalCalculated,
    ) = fCashLiquidation.notional.calculatefCashCrossCurrencyLiquidation.call(
        liquidated, 2, 1, maturities, [0, 0]
    )
    balanceBefore = fCashLiquidation.cToken["DAI"].balanceOf(accounts[0])

    txn = fCashLiquidation.notional.liquidatefCashCrossCurrency(
        liquidated, 2, 1, maturities, [0, 0]
    )

    balanceAfter = fCashLiquidation.cToken["DAI"].balanceOf(accounts[0])
    assert txn.events["LiquidatefCashEvent"]
    netLocal = txn.events["LiquidatefCashEvent"]["netLocalFromLiquidator"]
    transfers = txn.events["LiquidatefCashEvent"]["fCashNotionalTransfer"]

    assert pytest.approx(netLocal, rel=1e-5) == netLocalCalculated
    assert pytest.approx(transfers[0], rel=1e-5) == fCashNotionalCalculated[0]
    assert pytest.approx(transfers[1], rel=1e-5) == fCashNotionalCalculated[1]
    assert pytest.approx(balanceBefore - balanceAfter, rel=1e-5) == netLocal

    check_liquidation_invariants(fCashLiquidation, liquidated, fcBefore)


@pytest.mark.liquidation
def test_cannot_liquidate_self(fCashLiquidation, accounts):
    liquidated = accounts[7]
    fCashLiquidation.ethOracle["DAI"].setAnswer(0.017e18)
    liquidatedPortfolioBefore = fCashLiquidation.notional.getAccountPortfolio(liquidated)
    maturities = [asset[1] for asset in liquidatedPortfolioBefore]
    with brownie.reverts():
        fCashLiquidation.notional.liquidatefCashCrossCurrency(
            liquidated, 2, 1, maturities, [0, 0], {"from": liquidated}
        )


@pytest.mark.liquidation
def test_liquidator_settle_array_assets(fCashLiquidation, accounts):
    liquidated = accounts[7]
    collateral = get_balance_trade_action(
        1,
        "DepositUnderlying",
        [{"tradeActionType": "Lend", "marketIndex": 1, "notional": 1e8, "minSlippage": 0}],
        depositActionAmount=1e18,
    )

    fCashLiquidation.notional.batchBalanceAndTradeAction(
        accounts[0], [collateral], {"from": accounts[0], "value": 1e18}
    )
    # Decrease ETH rate
    fCashLiquidation.ethOracle["DAI"].setAnswer(0.014e18)
    # This will fail if there are matured assets.
    fcBefore = fCashLiquidation.notional.getFreeCollateral(liquidated)

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    fCashLiquidation.notional.initializeMarkets(1, False)
    fCashLiquidation.notional.initializeMarkets(2, False)

    liquidatedPortfolioBefore = fCashLiquidation.notional.getAccountPortfolio(liquidated)
    maturities = [asset[1] for asset in liquidatedPortfolioBefore]

    # The liquidator and liquidated accounts both have matured assets
    # Also we pass in the maturity of the matured asset here, should not affect
    # the liquidation, should only liquidate the eth fCash asset
    txn = fCashLiquidation.notional.liquidatefCashCrossCurrency(
        liquidated, 2, 1, maturities, [0, 0], {"from": accounts[0]}
    )

    assert txn.events["AccountSettled"][0]["account"] == liquidated
    assert txn.events["AccountSettled"][1]["account"] == accounts[0]

    check_liquidation_invariants(fCashLiquidation, liquidated, fcBefore)


@pytest.mark.liquidation
def test_liquidator_settle_bitmap_assets(fCashLiquidation, accounts):
    liquidated = accounts[7]
    collateral = get_balance_trade_action(
        1,
        "DepositUnderlying",
        [{"tradeActionType": "Lend", "marketIndex": 1, "notional": 1e8, "minSlippage": 0}],
        depositActionAmount=1e18,
    )

    fCashLiquidation.notional.enableBitmapCurrency(1, {"from": accounts[0]})
    fCashLiquidation.notional.batchBalanceAndTradeAction(
        accounts[0], [collateral], {"from": accounts[0], "value": 1e18}
    )
    # Decrease ETH rate
    fCashLiquidation.ethOracle["DAI"].setAnswer(0.014e18)
    # This will fail if there are matured assets.
    fcBefore = fCashLiquidation.notional.getFreeCollateral(liquidated)

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    fCashLiquidation.notional.initializeMarkets(1, False)
    fCashLiquidation.notional.initializeMarkets(2, False)

    liquidatedPortfolioBefore = fCashLiquidation.notional.getAccountPortfolio(liquidated)
    maturities = [asset[1] for asset in liquidatedPortfolioBefore]

    # The liquidator and liquidated accounts both have matured assets
    # Also we pass in the maturity of the matured asset here, should not affect
    # the liquidation, should only liquidate the eth fCash asset
    txn = fCashLiquidation.notional.liquidatefCashCrossCurrency(
        liquidated, 2, 1, maturities, [0, 0], {"from": accounts[0]}
    )

    assert txn.events["AccountSettled"][0]["account"] == liquidated
    assert txn.events["AccountSettled"][1]["account"] == accounts[0]

    check_liquidation_invariants(fCashLiquidation, liquidated, fcBefore)
