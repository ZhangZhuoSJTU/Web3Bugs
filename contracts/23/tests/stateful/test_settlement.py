import pytest
from brownie.network.state import Chain
from tests.constants import HAS_ASSET_DEBT, HAS_CASH_DEBT, SECONDS_IN_QUARTER
from tests.helpers import (
    get_balance_action,
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


def setup_multiple_asset_settlement(environment, account):
    daiAction = get_balance_trade_action(
        2,
        "None",
        [{"tradeActionType": "Borrow", "marketIndex": 1, "notional": 150e8, "maxSlippage": 0}],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )

    usdcAction = get_balance_trade_action(
        3,
        "DepositUnderlying",
        [{"tradeActionType": "Lend", "marketIndex": 1, "notional": 100e8, "minSlippage": 0}],
        depositActionAmount=10000e6,
    )

    environment.notional.batchBalanceAndTradeAction(
        account, [daiAction, usdcAction], {"from": account}
    )


def test_settle_on_batch_action(environment, accounts):
    account = accounts[1]
    setup_multiple_asset_settlement(environment, account)

    # Set the blockchain forward one quarter to settle
    blockTime = chain.time()
    newTime = get_tref(blockTime) + SECONDS_IN_QUARTER + 1
    chain.mine(1, timestamp=newTime)

    environment.notional.initializeMarkets(1, False)
    environment.notional.initializeMarkets(2, False)
    environment.notional.initializeMarkets(3, False)

    ethAction = get_balance_action(1, "DepositUnderlying", depositActionAmount=1e18)

    txn = environment.notional.batchBalanceAction(
        account, [ethAction], {"from": account, "value": 1e18}
    )
    assert txn.events["AccountSettled"]

    check_system_invariants(environment, accounts)


def test_settle_on_batch_trade_action(environment, accounts):
    account = accounts[1]
    setup_multiple_asset_settlement(environment, account)

    # Set the blockchain forward one quarter to settle
    blockTime = chain.time()
    newTime = get_tref(blockTime) + SECONDS_IN_QUARTER + 1
    chain.mine(1, timestamp=newTime)

    environment.notional.initializeMarkets(1, False)
    environment.notional.initializeMarkets(2, False)
    environment.notional.initializeMarkets(3, False)

    ethAction = get_balance_trade_action(
        1,
        "None",
        [{"tradeActionType": "Borrow", "marketIndex": 1, "notional": 10, "maxSlippage": 0}],
    )

    txn = environment.notional.batchBalanceAndTradeAction(account, [ethAction], {"from": account})
    assert txn.events["AccountSettled"]

    check_system_invariants(environment, accounts)


def test_settle_bitmap_to_cash(environment, accounts):
    currencyId = 2
    environment.notional.enableBitmapCurrency(currencyId, {"from": accounts[1]})

    fCashAmount = 100e8
    borrowAction = get_balance_trade_action(
        currencyId,
        "None",
        [
            {
                "tradeActionType": "Borrow",
                "marketIndex": 1,
                "notional": fCashAmount,
                "maxSlippage": 0,
            }
        ],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )
    collateral = get_balance_trade_action(3, "DepositAsset", [], depositActionAmount=50000e8)

    environment.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction, collateral], {"from": accounts[1]}
    )

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    txn = environment.notional.batchBalanceAndTradeAction(
        accounts[1], [collateral], {"from": accounts[1]}
    )
    portfolio = environment.notional.getAccountPortfolio(accounts[1])
    context = environment.notional.getAccountContext(accounts[1])
    balance = environment.notional.getAccountBalance(currencyId, accounts[1])
    assert len(portfolio) == 0
    assert context[1] == HAS_CASH_DEBT
    assert context[0] == get_tref(txn.timestamp)
    assert balance[0] == -5000e8

    check_system_invariants(environment, accounts)


def test_settle_bitmap_shift_assets(environment, accounts):
    currencyId = 2
    environment.notional.enableBitmapCurrency(currencyId, {"from": accounts[1]})

    fCashAmount = 100e8
    borrowAction = get_balance_trade_action(
        currencyId,
        "None",
        [
            {
                "tradeActionType": "Borrow",
                "marketIndex": 2,
                "notional": fCashAmount,
                "maxSlippage": 0,
            }
        ],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )
    collateral = get_balance_trade_action(3, "DepositAsset", [], depositActionAmount=50000e8)

    markets = environment.notional.getActiveMarkets(2)
    environment.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction, collateral], {"from": accounts[1]}
    )

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    txn = environment.notional.batchBalanceAndTradeAction(
        accounts[1], [collateral], {"from": accounts[1]}
    )
    portfolio = environment.notional.getAccountPortfolio(accounts[1])
    context = environment.notional.getAccountContext(accounts[1])
    assert len(portfolio) == 1
    assert portfolio[0][3] == -fCashAmount
    assert portfolio[0][1] == markets[1][1]
    assert context[1] == HAS_ASSET_DEBT
    assert context[0] == get_tref(txn.timestamp)

    check_system_invariants(environment, accounts)


def test_settle_array_to_cash(environment, accounts):
    currencyId = 2

    fCashAmount = 100e8
    borrowAction = get_balance_trade_action(
        currencyId,
        "None",
        [
            {
                "tradeActionType": "Borrow",
                "marketIndex": 1,
                "notional": fCashAmount,
                "maxSlippage": 0,
            }
        ],
        withdrawEntireCashBalance=True,
        redeemToUnderlying=True,
    )
    collateral = get_balance_trade_action(3, "DepositAsset", [], depositActionAmount=50000e8)

    environment.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction, collateral], {"from": accounts[1]}
    )

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(currencyId, False)

    environment.notional.batchBalanceAndTradeAction(
        accounts[1], [collateral], {"from": accounts[1]}
    )
    portfolio = environment.notional.getAccountPortfolio(accounts[1])
    context = environment.notional.getAccountContext(accounts[1])
    balance = environment.notional.getAccountBalance(currencyId, accounts[1])
    assert len(portfolio) == 0
    assert context[1] == HAS_CASH_DEBT
    assert balance[0] == -5000e8
    assert context[0] == 0

    check_system_invariants(environment, accounts)


def test_settle_on_withdraw(environment, accounts):
    account = accounts[1]
    setup_multiple_asset_settlement(environment, account)
    environment.notional.depositUnderlyingToken(account, 1, 1e18, {"from": account, "value": 1e18})

    # Set the blockchain forward one quarter to settle
    blockTime = chain.time()
    newTime = get_tref(blockTime) + SECONDS_IN_QUARTER + 1
    chain.mine(1, timestamp=newTime)

    environment.notional.initializeMarkets(1, False)
    environment.notional.initializeMarkets(2, False)
    environment.notional.initializeMarkets(3, False)

    txn = environment.notional.withdraw(1, 50e8, False, {"from": account})
    assert txn.events["AccountSettled"]

    check_system_invariants(environment, accounts)


def test_transfer_fcash_requires_settlement(environment, accounts):
    lend = get_balance_trade_action(
        1,
        "DepositUnderlying",
        [{"tradeActionType": "Lend", "marketIndex": 1, "notional": 1e8, "minSlippage": 0}],
        depositActionAmount=1e18,
    )

    environment.notional.enableBitmapCurrency(1, {"from": accounts[0]})
    environment.notional.batchBalanceAndTradeAction(
        accounts[0], [lend], {"from": accounts[0], "value": 1e18}
    )
    environment.notional.batchBalanceAndTradeAction(
        accounts[1], [lend], {"from": accounts[1], "value": 1e18}
    )

    blockTime = chain.time()
    chain.mine(1, timestamp=blockTime + SECONDS_IN_QUARTER)
    environment.notional.initializeMarkets(1, False)

    markets = environment.notional.getActiveMarkets(1)
    erc1155id = environment.notional.encodeToId(1, markets[0][1], 1)

    txn = environment.notional.safeTransferFrom(
        accounts[1], accounts[0], erc1155id, 0.1e8, bytes(), {"from": accounts[1]}
    )

    assert txn.events["AccountSettled"][0]["account"] == accounts[0]
    assert txn.events["AccountSettled"][1]["account"] == accounts[1]
    assert len(environment.notional.getAccountPortfolio(accounts[0])) == 1
    assert len(environment.notional.getAccountPortfolio(accounts[1])) == 1

    check_system_invariants(environment, accounts)
