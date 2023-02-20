import brownie
import pytest
from brownie.network.state import Chain
from tests.constants import HAS_ASSET_DEBT, RATE_PRECISION, SECONDS_IN_QUARTER
from tests.helpers import (
    active_currencies_to_list,
    get_balance_trade_action,
    get_tref,
    initialize_environment,
)
from tests.stateful.invariants import check_system_invariants

chain = Chain()


@pytest.fixture(scope="module", autouse=True)
def environment(accounts):
    return initialize_environment(accounts)


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


def test_add_liquidity_failures(environment, accounts):
    with brownie.reverts():
        action = get_balance_trade_action(
            2,
            "None",
            [
                {
                    "tradeActionType": "AddLiquidity",
                    "marketIndex": 1,
                    "notional": 100e8,
                    "minSlippage": 0,
                    "maxSlippage": 0.40 * RATE_PRECISION,
                }
            ],
        )

        environment.notional.batchBalanceAndTradeAction(
            accounts[1], [action], {"from": accounts[1]}
        )

    with brownie.reverts():
        action = get_balance_trade_action(
            2,
            "DepositAsset",
            [
                {
                    "tradeActionType": "AddLiquidity",
                    "marketIndex": 3,  # invalid market
                    "notional": 100e8,
                    "minSlippage": 0,
                    "maxSlippage": 0.40 * RATE_PRECISION,
                }
            ],
            depositActionAmount=100e8,
        )

        environment.notional.batchBalanceAndTradeAction(
            accounts[1], [action], {"from": accounts[1]}
        )

    with brownie.reverts():
        action = get_balance_trade_action(
            2,
            "DepositAsset",
            [
                {
                    "tradeActionType": "AddLiquidity",
                    "marketIndex": 1,
                    "notional": 500e8,  # insufficient cash
                    "minSlippage": 0,
                    "maxSlippage": 0.40 * RATE_PRECISION,
                }
            ],
            depositActionAmount=100e8,
        )

        environment.notional.batchBalanceAndTradeAction(
            accounts[1], [action], {"from": accounts[1]}
        )

    with brownie.reverts():
        action = get_balance_trade_action(
            2,
            "DepositAsset",
            [
                {
                    "tradeActionType": "AddLiquidity",
                    "marketIndex": 1,
                    "notional": 100e8,
                    "minSlippage": 0.35 * RATE_PRECISION,  # min bound
                    "maxSlippage": 0.40 * RATE_PRECISION,
                }
            ],
            depositActionAmount=100e8,
        )

        environment.notional.batchBalanceAndTradeAction(
            accounts[1], [action], {"from": accounts[1]}
        )

    with brownie.reverts():
        action = get_balance_trade_action(
            2,
            "DepositAsset",
            [
                {
                    "tradeActionType": "AddLiquidity",
                    "marketIndex": 1,
                    "notional": 100e8,
                    "minSlippage": 0,
                    "maxSlippage": 0.001 * RATE_PRECISION,  # max bound
                }
            ],
            depositActionAmount=100e8,
        )

        environment.notional.batchBalanceAndTradeAction(
            accounts[1], [action], {"from": accounts[1]}
        )


def test_remove_liquidity_failures(environment, accounts):
    with brownie.reverts():
        action = get_balance_trade_action(
            2,
            "None",
            [
                {
                    "tradeActionType": "RemoveLiquidity",
                    "marketIndex": 1,
                    "notional": 100e8,  # No liquidity
                    "minSlippage": 0,
                    "maxSlippage": 0.40 * RATE_PRECISION,
                }
            ],
        )

        environment.notional.batchBalanceAndTradeAction(
            accounts[1], [action], {"from": accounts[1]}
        )

    # Add liquidity to test rate bounds
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 1,
                "notional": 100e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            }
        ],
        depositActionAmount=100e8,
    )

    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})

    with brownie.reverts():
        action = get_balance_trade_action(
            2,
            "None",
            [
                {
                    "tradeActionType": "RemoveLiquidity",
                    "marketIndex": 1,
                    "notional": 100e8,
                    "minSlippage": 0,
                    "maxSlippage": 0.001 * RATE_PRECISION,  # max bound
                }
            ],
        )

        environment.notional.batchBalanceAndTradeAction(
            accounts[1], [action], {"from": accounts[1]}
        )

    with brownie.reverts():
        action = get_balance_trade_action(
            2,
            "None",
            [
                {
                    "tradeActionType": "RemoveLiquidity",
                    "marketIndex": 1,
                    "notional": 100e8,
                    "minSlippage": 0.39 * RATE_PRECISION,  # min bound
                    "maxSlippage": 0.40 * RATE_PRECISION,
                }
            ],
        )

        environment.notional.batchBalanceAndTradeAction(
            accounts[1], [action], {"from": accounts[1]}
        )


def test_deposit_asset_add_liquidity(environment, accounts):
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 1,
                "notional": 100e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            }
        ],
        depositActionAmount=100e8,
    )
    marketsBefore = environment.notional.getActiveMarkets(2)

    txn = environment.notional.batchBalanceAndTradeAction(
        accounts[1], [action], {"from": accounts[1]}
    )

    assert txn.events["AddRemoveLiquidity"][0]["account"] == accounts[1]
    assert txn.events["AddRemoveLiquidity"][0]["currencyId"] == 2

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == [(2, True, False)]
    assert context[0] == get_tref(chain.time()) + SECONDS_IN_QUARTER
    assert context[1] == HAS_ASSET_DEBT
    assert (0, 0, 0) == environment.notional.getAccountBalance(2, accounts[1])

    portfolio = environment.notional.getAccountPortfolio(accounts[1])
    marketsAfter = environment.notional.getActiveMarkets(2)

    assert marketsBefore[1] == marketsAfter[1]
    assert marketsAfter[0][2] - marketsBefore[0][2] == -portfolio[0][3]
    assert marketsAfter[0][3] - marketsBefore[0][3] == 100e8
    assert marketsAfter[0][4] - marketsBefore[0][4] == portfolio[1][3]

    check_system_invariants(environment, accounts)


def test_remove_liquidity(environment, accounts):
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 1,
                "notional": 100e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            }
        ],
        depositActionAmount=100e8,
    )
    marketsBefore = environment.notional.getActiveMarkets(2)

    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})

    action = get_balance_trade_action(
        2,
        "None",
        [
            {
                "tradeActionType": "RemoveLiquidity",
                "marketIndex": 1,
                "notional": 100e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            }
        ],
        withdrawEntireCashBalance=True,
    )
    txn = environment.notional.batchBalanceAndTradeAction(
        accounts[1], [action], {"from": accounts[1]}
    )

    assert txn.events["AddRemoveLiquidity"][0]["account"] == accounts[1]
    assert txn.events["AddRemoveLiquidity"][0]["currencyId"] == 2

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == []
    assert context[0] == 0
    assert context[1] == "0x00"
    assert (0, 0, 0) == environment.notional.getAccountBalance(2, accounts[1])

    portfolio = environment.notional.getAccountPortfolio(accounts[1])

    marketsAfter = environment.notional.getActiveMarkets(2)
    assert marketsBefore[0] == marketsAfter[0]
    assert marketsBefore[1] == marketsAfter[1]
    assert portfolio == []

    check_system_invariants(environment, accounts)


def test_roll_liquidity_to_maturity(environment, accounts):
    action = get_balance_trade_action(
        2,
        "DepositAsset",
        [
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 1,
                "notional": 100e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            }
        ],
        depositActionAmount=100e8,
    )
    marketsBefore = environment.notional.getActiveMarkets(2)

    environment.notional.batchBalanceAndTradeAction(accounts[1], [action], {"from": accounts[1]})

    action = get_balance_trade_action(
        2,
        "None",
        [
            {
                "tradeActionType": "RemoveLiquidity",
                "marketIndex": 1,
                "notional": 100e8,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            },
            {
                "tradeActionType": "AddLiquidity",
                "marketIndex": 2,
                "notional": 0,
                "minSlippage": 0,
                "maxSlippage": 0.40 * RATE_PRECISION,
            },
        ],
    )

    txn = environment.notional.batchBalanceAndTradeAction(
        accounts[1], [action], {"from": accounts[1]}
    )

    marketsAfter = environment.notional.getActiveMarkets(2)
    assert txn.events["AddRemoveLiquidity"][0]["account"] == accounts[1]
    assert txn.events["AddRemoveLiquidity"][0]["currencyId"] == 2

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == [(2, True, False)]
    assert context[0] == get_tref(chain.time()) + SECONDS_IN_QUARTER
    assert context[1] == HAS_ASSET_DEBT
    assert (0, 0, 0) == environment.notional.getAccountBalance(2, accounts[1])

    portfolio = environment.notional.getAccountPortfolio(accounts[1])

    assert marketsBefore[0] == marketsAfter[0]
    assert marketsAfter[1][2] - marketsBefore[1][2] == -portfolio[0][3]
    assert marketsAfter[1][3] - marketsBefore[1][3] == 100e8
    assert marketsAfter[1][4] - marketsBefore[1][4] == portfolio[1][3]

    check_system_invariants(environment, accounts)
