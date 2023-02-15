import brownie
import pytest
from brownie.network.state import Chain
from tests.helpers import active_currencies_to_list, get_balance_action, initialize_environment
from tests.stateful.invariants import check_system_invariants

chain = Chain()


@pytest.fixture(scope="module", autouse=True)
def environment(accounts):
    return initialize_environment(accounts)


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


def test_fails_on_unordered_currencies(environment, accounts):
    with brownie.reverts("Unsorted actions"):
        environment.notional.batchBalanceAction(
            accounts[0],
            [
                get_balance_action(3, "DepositAsset", depositActionAmount=int(100e8)),
                get_balance_action(2, "DepositAsset", depositActionAmount=int(100e8)),
            ],
        )

    with brownie.reverts("Unsorted actions"):
        environment.notional.batchBalanceAction(
            accounts[0],
            [
                get_balance_action(2, "DepositAsset", depositActionAmount=100e8),
                get_balance_action(2, "DepositAsset", depositActionAmount=100e8),
            ],
        )


def test_fails_on_invalid_currencies(environment, accounts):
    with brownie.reverts():
        environment.notional.batchBalanceAction(
            accounts[0],
            [
                get_balance_action(2, "DepositAsset", depositActionAmount=100e8),
                get_balance_action(5, "DepositAsset", depositActionAmount=100e8),
            ],
        )


def test_fails_on_unauthorized_caller(environment, accounts):
    with brownie.reverts():
        environment.notional.batchBalanceAction(
            accounts[1],
            [
                get_balance_action(2, "DepositAsset", depositActionAmount=100e8),
                get_balance_action(3, "DepositAsset", depositActionAmount=100e8),
            ],
            {"from": accounts[0]},
        )


def test_deposit_asset_batch(environment, accounts):
    txn = environment.notional.batchBalanceAction(
        accounts[1],
        [
            get_balance_action(2, "DepositAsset", depositActionAmount=100e8),
            get_balance_action(3, "DepositAsset", depositActionAmount=100e8),
        ],
        {"from": accounts[1]},
    )

    assert txn.events["CashBalanceChange"][0]["account"] == accounts[1]
    assert txn.events["CashBalanceChange"][0]["currencyId"] == 2
    assert txn.events["CashBalanceChange"][0]["netCashChange"] == 100e8

    assert txn.events["CashBalanceChange"][1]["account"] == accounts[1]
    assert txn.events["CashBalanceChange"][1]["currencyId"] == 3
    assert txn.events["CashBalanceChange"][1]["netCashChange"] == 100e8

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == [(2, False, True), (3, False, True)]

    balances = environment.notional.getAccountBalance(2, accounts[1])
    assert balances[0] == 100e8
    assert balances[1] == 0
    assert balances[2] == 0

    balances = environment.notional.getAccountBalance(3, accounts[1])
    assert balances[0] == 100e8
    assert balances[1] == 0
    assert balances[2] == 0

    check_system_invariants(environment, accounts)


def test_deposit_underlying_batch(environment, accounts):
    txn = environment.notional.batchBalanceAction(
        accounts[1],
        [
            get_balance_action(2, "DepositUnderlying", depositActionAmount=100e18),
            get_balance_action(3, "DepositUnderlying", depositActionAmount=100e6),
        ],
        {"from": accounts[1]},
    )

    assert txn.events["CashBalanceChange"][0]["account"] == accounts[1]
    assert txn.events["CashBalanceChange"][0]["currencyId"] == 2
    assert txn.events["CashBalanceChange"][0]["netCashChange"] == 5000e8

    assert txn.events["CashBalanceChange"][1]["account"] == accounts[1]
    assert txn.events["CashBalanceChange"][1]["currencyId"] == 3
    assert txn.events["CashBalanceChange"][1]["netCashChange"] == 5000e8

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == [(2, False, True), (3, False, True)]

    balances = environment.notional.getAccountBalance(2, accounts[1])
    assert balances[0] == 5000e8
    assert balances[1] == 0
    assert balances[2] == 0

    balances = environment.notional.getAccountBalance(3, accounts[1])
    assert balances[0] == 5000e8
    assert balances[1] == 0
    assert balances[2] == 0

    check_system_invariants(environment, accounts)


def test_deposit_asset_and_mint_perpetual(environment, accounts):
    txn = environment.notional.batchBalanceAction(
        accounts[1],
        [
            get_balance_action(2, "DepositAssetAndMintNToken", depositActionAmount=100e8),
            get_balance_action(3, "DepositAssetAndMintNToken", depositActionAmount=100e8),
        ],
        {"from": accounts[1]},
    )

    assert txn.events["nTokenSupplyChange"][0]["account"] == accounts[1]
    assert txn.events["nTokenSupplyChange"][0]["currencyId"] == 2
    assert txn.events["nTokenSupplyChange"][0]["tokenSupplyChange"] == 100e8

    assert txn.events["nTokenSupplyChange"][1]["account"] == accounts[1]
    assert txn.events["nTokenSupplyChange"][1]["currencyId"] == 3
    assert txn.events["nTokenSupplyChange"][1]["tokenSupplyChange"] == 100e8

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == [(2, False, True), (3, False, True)]

    balances = environment.notional.getAccountBalance(2, accounts[1])
    assert balances[0] == 0
    assert balances[1] == 100e8
    assert balances[2] == txn.timestamp

    balances = environment.notional.getAccountBalance(3, accounts[1])
    assert balances[0] == 0
    assert balances[1] == 100e8
    assert balances[2] == txn.timestamp

    check_system_invariants(environment, accounts)


def test_deposit_underlying_and_mint_perpetual(environment, accounts):
    txn = environment.notional.batchBalanceAction(
        accounts[1],
        [
            get_balance_action(2, "DepositUnderlyingAndMintNToken", depositActionAmount=100e18),
            get_balance_action(3, "DepositUnderlyingAndMintNToken", depositActionAmount=100e6),
        ],
        {"from": accounts[1]},
    )

    assert txn.events["nTokenSupplyChange"][0]["account"] == accounts[1]
    assert txn.events["nTokenSupplyChange"][0]["currencyId"] == 2
    assert txn.events["nTokenSupplyChange"][0]["tokenSupplyChange"] == 5000e8

    assert txn.events["nTokenSupplyChange"][1]["account"] == accounts[1]
    assert txn.events["nTokenSupplyChange"][1]["currencyId"] == 3
    assert txn.events["nTokenSupplyChange"][1]["tokenSupplyChange"] == 5000e8

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == [(2, False, True), (3, False, True)]

    balances = environment.notional.getAccountBalance(2, accounts[1])
    assert balances[0] == 0
    assert balances[1] == 5000e8
    assert balances[2] == txn.timestamp

    balances = environment.notional.getAccountBalance(3, accounts[1])
    assert balances[0] == 0
    assert balances[1] == 5000e8
    assert balances[2] == txn.timestamp

    check_system_invariants(environment, accounts)


def test_redeem_perpetual(environment, accounts):
    environment.notional.batchBalanceAction(
        accounts[1],
        [
            get_balance_action(2, "DepositAssetAndMintNToken", depositActionAmount=100e8),
            get_balance_action(3, "DepositAssetAndMintNToken", depositActionAmount=100e8),
        ],
        {"from": accounts[1]},
    )

    txn = environment.notional.batchBalanceAction(
        accounts[1],
        [
            get_balance_action(2, "RedeemNToken", depositActionAmount=100e8),
            get_balance_action(3, "RedeemNToken", depositActionAmount=100e8),
        ],
        {"from": accounts[1]},
    )

    assert txn.events["nTokenSupplyChange"][0]["account"] == accounts[1]
    assert txn.events["nTokenSupplyChange"][0]["currencyId"] == 2
    assert txn.events["nTokenSupplyChange"][0]["tokenSupplyChange"] == -100e8

    assert txn.events["nTokenSupplyChange"][1]["account"] == accounts[1]
    assert txn.events["nTokenSupplyChange"][1]["currencyId"] == 3
    assert txn.events["nTokenSupplyChange"][1]["tokenSupplyChange"] == -100e8

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == [(2, False, True), (3, False, True)]

    balances = environment.notional.getAccountBalance(2, accounts[1])
    assert balances[0] == 100e8
    assert balances[1] == 0
    assert balances[2] == txn.timestamp

    balances = environment.notional.getAccountBalance(3, accounts[1])
    assert balances[0] == 100e8
    assert balances[1] == 0
    assert balances[2] == txn.timestamp
    # TODO: test incentives

    check_system_invariants(environment, accounts)


def test_redeem_perpetual_and_withdraw_asset(environment, accounts):
    environment.notional.batchBalanceAction(
        accounts[1],
        [
            get_balance_action(2, "DepositAssetAndMintNToken", depositActionAmount=100e8),
            get_balance_action(3, "DepositAssetAndMintNToken", depositActionAmount=100e8),
        ],
        {"from": accounts[1]},
    )

    daiBalanceBefore = environment.cToken["DAI"].balanceOf(accounts[1])
    usdcBalanceBefore = environment.cToken["USDC"].balanceOf(accounts[1])

    txn = environment.notional.batchBalanceAction(
        accounts[1],
        [
            get_balance_action(
                2, "RedeemNToken", depositActionAmount=100e8, withdrawEntireCashBalance=True
            ),
            get_balance_action(
                3, "RedeemNToken", depositActionAmount=100e8, withdrawEntireCashBalance=True
            ),
        ],
        {"from": accounts[1]},
    )

    daiBalanceAfter = environment.cToken["DAI"].balanceOf(accounts[1])
    usdcBalanceAfter = environment.cToken["USDC"].balanceOf(accounts[1])

    assert txn.events["nTokenSupplyChange"][0]["account"] == accounts[1]
    assert txn.events["nTokenSupplyChange"][0]["currencyId"] == 2
    assert txn.events["nTokenSupplyChange"][0]["tokenSupplyChange"] == -100e8

    assert txn.events["nTokenSupplyChange"][1]["account"] == accounts[1]
    assert txn.events["nTokenSupplyChange"][1]["currencyId"] == 3
    assert txn.events["nTokenSupplyChange"][1]["tokenSupplyChange"] == -100e8

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == []

    balances = environment.notional.getAccountBalance(2, accounts[1])
    assert balances[0] == 0
    assert balances[1] == 0
    assert balances[2] == txn.timestamp
    assert daiBalanceAfter - daiBalanceBefore == 100e8

    balances = environment.notional.getAccountBalance(3, accounts[1])
    assert balances[0] == 0
    assert balances[1] == 0
    assert balances[2] == txn.timestamp
    assert usdcBalanceAfter - usdcBalanceBefore == 100e8
    # TODO: test incentives

    check_system_invariants(environment, accounts)


def test_redeem_perpetual_and_withdraw_underlying(environment, accounts):
    environment.notional.batchBalanceAction(
        accounts[1],
        [
            get_balance_action(2, "DepositUnderlyingAndMintNToken", depositActionAmount=100e18),
            get_balance_action(3, "DepositUnderlyingAndMintNToken", depositActionAmount=100e6),
        ],
        {"from": accounts[1]},
    )

    daiBalanceBefore = environment.token["DAI"].balanceOf(accounts[1])
    usdcBalanceBefore = environment.token["USDC"].balanceOf(accounts[1])

    txn = environment.notional.batchBalanceAction(
        accounts[1],
        [
            get_balance_action(
                2,
                "RedeemNToken",
                depositActionAmount=100e8,
                withdrawEntireCashBalance=True,
                redeemToUnderlying=True,
            ),
            get_balance_action(
                3,
                "RedeemNToken",
                depositActionAmount=100e8,
                withdrawEntireCashBalance=True,
                redeemToUnderlying=True,
            ),
        ],
        {"from": accounts[1]},
    )

    daiBalanceAfter = environment.token["DAI"].balanceOf(accounts[1])
    usdcBalanceAfter = environment.token["USDC"].balanceOf(accounts[1])

    assert txn.events["nTokenSupplyChange"][0]["account"] == accounts[1]
    assert txn.events["nTokenSupplyChange"][0]["currencyId"] == 2
    assert txn.events["nTokenSupplyChange"][0]["tokenSupplyChange"] == -100e8

    assert txn.events["nTokenSupplyChange"][1]["account"] == accounts[1]
    assert txn.events["nTokenSupplyChange"][1]["currencyId"] == 3
    assert txn.events["nTokenSupplyChange"][1]["tokenSupplyChange"] == -100e8

    context = environment.notional.getAccountContext(accounts[1])
    activeCurrenciesList = active_currencies_to_list(context[4])
    assert activeCurrenciesList == [(2, False, True), (3, False, True)]

    balances = environment.notional.getAccountBalance(2, accounts[1])
    assert balances[0] == 0
    assert balances[1] == 4900e8
    assert balances[2] == txn.timestamp
    assert daiBalanceAfter - daiBalanceBefore == 2e18

    balances = environment.notional.getAccountBalance(3, accounts[1])
    assert balances[0] == 0
    assert balances[1] == 4900e8
    assert balances[2] == txn.timestamp
    assert usdcBalanceAfter - usdcBalanceBefore == 2e6

    check_system_invariants(environment, accounts)


def test_convert_cash_to_ntoken(environment, accounts):
    environment.notional.batchBalanceAction(
        accounts[1],
        [get_balance_action(2, "DepositAsset", depositActionAmount=100000e8)],
        {"from": accounts[1]},
    )
    balances = environment.notional.getAccountBalance(2, accounts[1])
    assert balances[0] == 100000e8
    assert balances[1] == 0
    assert balances[2] == 0

    with brownie.reverts("Insufficient cash"):
        environment.notional.batchBalanceAction(
            accounts[1],
            [get_balance_action(2, "ConvertCashToNToken", depositActionAmount=1000000e8)],
            {"from": accounts[1]},
        )

    txn = environment.notional.batchBalanceAction(
        accounts[1],
        [get_balance_action(2, "ConvertCashToNToken", depositActionAmount=100000e8)],
        {"from": accounts[1]},
    )

    balances = environment.notional.getAccountBalance(2, accounts[1])
    assert balances[0] == 0
    assert balances[1] == 100000e8
    assert balances[2] == txn.timestamp

    check_system_invariants(environment, accounts)
