from decimal import Decimal
import pytest
import brownie

from support.utils import scale

INITIAL_BAL = 10_000 * 10 ** 18  # see config: 10k ETH default user balance


def test_redeem_for_underlying(alice, vault, lpToken, pool, initialAmount):
    tx = pool.deposit(initialAmount, {"from": alice, "value": initialAmount})
    wei_used_for_gas = tx.gas_used * tx.gas_price

    # dev: exchange rate is 1; pool amount == underlying amount
    assert alice.balance() == INITIAL_BAL - initialAmount - wei_used_for_gas
    assert lpToken.balanceOf(alice) == initialAmount
    assert pool.balance() == 0
    assert vault.balance() == initialAmount
    assert lpToken.balanceOf(alice) == initialAmount
    assert lpToken.totalSupply() == initialAmount

    tx = pool.redeem(initialAmount, {"from": alice})
    assert tx.events["Redeem"][0]["redeemer"] == alice
    assert tx.events["Redeem"][0]["redeemAmount"] == initialAmount
    assert tx.events["Redeem"][0]["redeemTokens"] == initialAmount
    wei_used_for_gas += tx.gas_used * tx.gas_price
    assert alice.balance() == INITIAL_BAL - wei_used_for_gas
    assert lpToken.balanceOf(alice) == 0
    assert pool.balance() == 0
    assert vault.balance() == 0
    assert lpToken.totalSupply() == 0


def test_redeem_fail_insufficient_balance(alice, lpToken, pool, initialAmount):
    pool.deposit(initialAmount, {"from": alice, "value": initialAmount})
    assert lpToken.totalSupply() == initialAmount
    with brownie.reverts("insufficient balance"):
        pool.redeem(2 * initialAmount, {"from": alice})


def test_redeem_charge_no_withdrawal_fee(bob, admin, pool, initialAmount):
    # dev: set 1% withdrawal fee
    newFee = scale("0.01", 18)
    pool.setMaxWithdrawalFee(newFee, {"from": admin})
    pool.setMinWithdrawalFee(newFee, {"from": admin})
    tx = pool.deposit(initialAmount, {"from": bob, "value": initialAmount})
    wei_used_for_gas = tx.gas_used * tx.gas_price
    tx = pool.redeem(initialAmount, {"from": bob})
    wei_used_for_gas += tx.gas_used * tx.gas_price
    assert pool.balance() == 0
    assert bob.balance() == INITIAL_BAL - wei_used_for_gas


def test_redeem_charge_withdrawal_fee(
    alice, bob, vault, lpToken, admin, pool, initialAmount
):
    newFee = scale("0.01", 18)
    pool.setMaxWithdrawalFee(newFee, {"from": admin})
    pool.setMinWithdrawalFee(newFee, {"from": admin})
    tx = pool.deposit(initialAmount, {"from": alice, "value": initialAmount})
    alice_wei_used_for_gas = tx.gas_used * tx.gas_price
    tx = pool.deposit(initialAmount, {"from": bob, "value": initialAmount})
    bob_wei_used_for_gas = tx.gas_used * tx.gas_price
    assert vault.balance() == initialAmount * 2

    assert lpToken.balanceOf(bob) == initialAmount
    tx = pool.redeem(initialAmount, {"from": bob})
    bob_wei_used_for_gas += tx.gas_used * tx.gas_price
    assert vault.balance() == Decimal("1.01") * initialAmount
    assert bob.balance() == Decimal("0.99") * initialAmount + (
        INITIAL_BAL - initialAmount - bob_wei_used_for_gas
    )
    assert alice.balance() == INITIAL_BAL - initialAmount - alice_wei_used_for_gas

    tx = pool.redeem(initialAmount, {"from": alice})
    alice_wei_used_for_gas += tx.gas_used * tx.gas_price
    assert vault.balance() == 0
    assert pytest.approx(alice.balance()) == Decimal("1.01") * initialAmount + (
        INITIAL_BAL - initialAmount - alice_wei_used_for_gas
    )
    assert lpToken.balanceOf(alice) == 0
    assert lpToken.balanceOf(bob) == 0
    assert lpToken.totalSupply() == 0


def test_redeem_withdrawal_fee_exchange_rate(
    alice, vault, initialAmount, decimals, lpToken, admin, pool
):
    fee = 0.05 * 1e18
    pool.setMaxWithdrawalFee(fee, {"from": admin})
    pool.setMinWithdrawalFee(fee, {"from": admin})
    pool.deposit(initialAmount, {"from": alice, "value": initialAmount})
    assert vault.balance() == initialAmount

    redeemAmount = 10 ** decimals
    pool.redeem(redeemAmount, {"from": alice})

    assert pytest.approx(alice.balance()) == 0.95 * redeemAmount + (
        INITIAL_BAL - initialAmount
    )
    assert lpToken.balanceOf(alice) == initialAmount - redeemAmount
    assert vault.balance() == initialAmount - 0.95 * redeemAmount
    exchangeRate = (
        10 ** 18
        * (initialAmount - 0.95 * redeemAmount)
        / (initialAmount - redeemAmount)
    )
    assert pytest.approx(pool.exchangeRate.call()) == exchangeRate
