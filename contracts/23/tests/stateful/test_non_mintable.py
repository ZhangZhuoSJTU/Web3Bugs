import brownie
import pytest
from brownie.convert.datatypes import Wei
from brownie.network.state import Chain
from scripts.config import CurrencyDefaults
from tests.constants import SECONDS_IN_QUARTER
from tests.helpers import (
    active_currencies_to_list,
    get_balance_action,
    get_balance_trade_action,
    initialize_environment,
)
from tests.stateful.invariants import check_system_invariants
from tests.stateful.test_initialize_markets import ntoken_asserts

chain = Chain()

INITIAL_CASH_AMOUNT = Wei(100000e18)


@pytest.fixture(scope="module", autouse=True)
def environment(accounts):
    env = initialize_environment(accounts)
    env.enableCurrency("NOMINT", CurrencyDefaults)
    env.token["NOMINT"].approve(env.notional.address, 2 ** 255, {"from": accounts[1]})
    env.token["NOMINT"].transfer(accounts[1], INITIAL_CASH_AMOUNT * 2, {"from": accounts[0]})
    return env


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


def test_cannot_deposit_underlying_non_mintable(environment, accounts):
    currencyId = 5

    with brownie.reverts():
        environment.notional.depositUnderlyingToken(
            accounts[1], currencyId, 100e18, {"from": accounts[1]}
        )


def test_cannot_withdraw_to_underlying_non_mintable(environment, accounts):
    currencyId = 5

    environment.notional.depositAssetToken(accounts[1], currencyId, 100e18, {"from": accounts[1]})

    with brownie.reverts():
        environment.notional.withdraw(currencyId, 100e8, True, {"from": accounts[1]})


def test_deposit_withdraw_asset_non_mintable(environment, accounts):
    currencyId = 5

    txn = environment.notional.depositAssetToken(
        accounts[1], currencyId, 100e18, {"from": accounts[1]}
    )

    assert txn.events["CashBalanceChange"]["account"] == accounts[1]
    assert txn.events["CashBalanceChange"]["currencyId"] == currencyId
    assert txn.events["CashBalanceChange"]["netCashChange"] == 100e8

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == [(currencyId, False, True)]

    balances = environment.notional.getAccountBalance(currencyId, accounts[1])
    assert balances[0] == 100e8
    assert balances[1] == 0
    assert balances[2] == 0

    (fc, netLocal) = environment.notional.getFreeCollateral(accounts[1])
    assert fc == 70e8
    assert netLocal[0] == 100e8

    check_system_invariants(environment, accounts)

    txn = environment.notional.withdraw(currencyId, 100e8, False, {"from": accounts[1]})
    assert txn.events["CashBalanceChange"]["account"] == accounts[1]
    assert txn.events["CashBalanceChange"]["currencyId"] == currencyId
    assert txn.events["CashBalanceChange"]["netCashChange"] == -100e8

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == []

    balances = environment.notional.getAccountBalance(currencyId, accounts[1])
    assert balances[0] == 0
    assert balances[1] == 0
    assert balances[2] == 0

    check_system_invariants(environment, accounts)


def test_initialize_markets_non_mintable(environment, accounts):
    currencyId = 5
    environment.notional.updateDepositParameters(currencyId, [0.4e8, 0.6e8], [0.8e9, 0.8e9])

    environment.notional.updateInitializationParameters(
        currencyId, [0.02e9, 0.02e9], [0.5e9, 0.5e9]
    )

    environment.notional.batchBalanceAction(
        accounts[1],
        [
            get_balance_action(
                currencyId, "DepositAssetAndMintNToken", depositActionAmount=INITIAL_CASH_AMOUNT
            )
        ],
        {"from": accounts[1]},
    )
    environment.notional.initializeMarkets(currencyId, True)
    ntoken_asserts(environment, currencyId, True, accounts)

    # Lend
    action = get_balance_trade_action(
        currencyId,
        "DepositAsset",
        [{"tradeActionType": "Lend", "marketIndex": 1, "notional": 100e8, "minSlippage": 0}],
        depositActionAmount=100e18,
        withdrawEntireCashBalance=True,
    )

    marketsBefore = environment.notional.getActiveMarkets(currencyId)
    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})
    portfolio = environment.notional.getAccountPortfolio(accounts[1])
    assert portfolio[0][0] == currencyId
    assert portfolio[0][1] == marketsBefore[0][1]
    assert portfolio[0][2] == 1
    assert portfolio[0][3] == 100e8

    # Borrow
    borrowAction = get_balance_trade_action(
        currencyId,
        "None",
        [{"tradeActionType": "Borrow", "marketIndex": 2, "notional": 10e8, "maxSlippage": 0}],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=False,
    )

    environment.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction], {"from": accounts[1]}
    )
    portfolio = environment.notional.getAccountPortfolio(accounts[1])
    assert portfolio[1][0] == currencyId
    assert portfolio[1][1] == marketsBefore[1][1]
    assert portfolio[1][2] == 1
    assert portfolio[1][3] == -10e8

    check_system_invariants(environment, accounts)

    # Test Settlement
    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    txn = environment.notional.withdraw(currencyId, 30e8, False, {"from": accounts[1]})
    assert txn.events["AccountSettled"]
    portfolio = environment.notional.getAccountPortfolio(accounts[1])
    assert len(portfolio) == 1
    (cashBalance, nTokenBalance, _) = environment.notional.getAccountBalance(
        currencyId, accounts[1]
    )
    assert cashBalance == 70e8
    assert nTokenBalance == 100000e8

    check_system_invariants(environment, accounts)
