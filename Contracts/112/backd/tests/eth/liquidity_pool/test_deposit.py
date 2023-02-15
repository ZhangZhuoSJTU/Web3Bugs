import pytest
import brownie

from brownie import ZERO_ADDRESS

from support.utils import scale

INITIAL_AMOUNT = 10000 * 10**18  # see config: 10k ETH by default


def test_deposit_insufficient_funds(charlie, pool, decimals):
    assert charlie.balance() == INITIAL_AMOUNT
    with brownie.reverts("invalid amount"):
        pool.deposit(10**decimals, {"from": charlie, "value": 0})


def test_deposit(alice, pool, lpToken, decimals):
    tx = pool.deposit(10**decimals, {"from": alice, "value": 10**decimals})
    assert lpToken.balanceOf(alice) == 10**decimals
    assert tx.events["Deposit"][0]["minter"] == alice
    assert tx.events["Deposit"][0]["depositAmount"] == 10**decimals
    assert tx.events["Deposit"][0]["mintedLpTokens"] == 10**decimals


def test_multiple_deposits(alice, bob, charlie, lpToken, decimals, pool):
    pool.deposit(10**decimals, {"from": alice, "value": 10**decimals})
    assert pool.exchangeRate() == 1e18
    assert lpToken.balanceOf(alice) == 10**decimals
    pool.deposit(10**decimals, {"from": bob, "value": 10**decimals})
    assert pool.exchangeRate() == 1e18
    assert lpToken.balanceOf(bob) == 10**decimals
    pool.deposit(10**decimals, {"from": charlie, "value": 10**decimals})
    assert lpToken.balanceOf(charlie) == 10**decimals


def test_mint_for_diff_account(alice, bob, lpToken, pool, coin, decimals):
    current_eth_balance = alice.balance()
    tx = pool.depositFor(bob, 10**decimals, {"from": alice, "value": 10**decimals})
    assert tx.events["DepositFor"][0]["minter"] == alice
    assert tx.events["DepositFor"][0]["mintee"] == bob
    assert tx.events["DepositFor"][0]["depositAmount"] == 10**decimals
    assert tx.events["DepositFor"][0]["mintedLpTokens"] == 10**decimals
    assert lpToken.balanceOf(bob) == 10**decimals
    assert lpToken.balanceOf(alice) == 0
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert alice.balance() == current_eth_balance - 10**decimals - wei_used_for_gas


def test_deposit_and_stake(
    alice, pool, lpToken, decimals, stakerVault, address_provider, admin
):
    address_provider.addPool(pool, {"from": admin})
    tx = pool.depositAndStake(
        scale(10, decimals), 0, {"from": alice, "value": scale(10, decimals)}
    )
    assert lpToken.balanceOf(alice) == 0
    assert stakerVault.balanceOf(alice) == scale(10, decimals)
    assert tx.events["Deposit"][0]["minter"] == alice
    assert tx.events["Deposit"][0]["depositAmount"] == scale(10, decimals)
    assert tx.events["Deposit"][0]["mintedLpTokens"] == scale(10, decimals)
