import pytest


def test_exchange_rate_unchanged(alice, decimals, pool):
    pool.deposit(10 ** decimals, {"from": alice, "value": 10 ** decimals})
    assert pool.exchangeRate() == 1e18


def test_exchange_rate_appreciates(alice, decimals, pool):
    pool.deposit(10 ** decimals, {"from": alice, "value": 10 ** decimals})
    assert pool.exchangeRate() == 1e18
    alice.transfer(pool, 10 ** decimals)
    assert pool.exchangeRate() == 2 * 1e18


def test_redeem_plus_interest_minus_withdrawal_fee(alice, bob, admin, pool, decimals):
    assert pool.exchangeRate() == 1e18
    balance = alice.balance() - 10 ** decimals

    pool.setMaxWithdrawalFee(0.05 * 1e18, {"from": admin})
    pool.setMinWithdrawalFee(0.05 * 1e18, {"from": admin})

    pool.deposit(10 ** decimals, {"from": alice, "value": 10 ** decimals})

    bob.transfer(pool, 0.1 * 10 ** decimals)  # mock yield

    pool.deposit(10 ** decimals, {"from": bob, "value": 10 ** decimals})

    pool.redeem(10 ** decimals, {"from": alice})
    # dev: performance fee on profits + withdrawal fee on total
    expectedBalance = ((10 ** decimals * 0.1 * 0.95) + 10 ** decimals) * 0.95 + balance
    assert pytest.approx(alice.balance()) == expectedBalance
