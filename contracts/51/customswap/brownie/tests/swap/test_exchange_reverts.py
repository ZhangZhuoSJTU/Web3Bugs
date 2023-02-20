import brownie
import pytest
from brownie import chain

pytestmark = pytest.mark.usefixtures("add_initial_liquidity", "approve_bob")


@pytest.mark.itercoins("sending", "receiving")
def test_insufficient_balance(bob, swap, coins, sending, receiving, decimals):
    amount = 10 ** decimals[sending]
    coins[sending]._mint_for_testing(bob, amount, {"from": bob})

    with brownie.reverts():
        swap.swap(sending, receiving, amount + 1, 0, chain.time() + 60, {"from": bob})


@pytest.mark.itercoins("sending", "receiving")
def test_min_dy_too_high(bob, swap, coins, sending, receiving, decimals):
    amount = 10 ** decimals[sending]
    coins[sending]._mint_for_testing(bob, amount, {"from": bob})
    
    min_dy = swap.calculateSwap(sending, receiving, amount)
    with brownie.reverts():
        swap.swap(sending, receiving, amount, min_dy + 2, chain.time() + 60, {"from": bob})


@pytest.mark.itercoins("idx")
def test_same_coin(bob, swap, idx):
    with brownie.reverts():
        swap.swap(idx, idx, 0, 0, chain.time() + 60, {"from": bob})


# TBD: How to force negative integer passed?
#
#@pytest.mark.parametrize("idx", [-1, -(2 ** 127)])
#def test_i_below_zero(bob, swap, idx):
#    with brownie.reverts():
#        swap.swap(idx, 0, 0, 0, chain.time() + 60, {"from": bob})


@pytest.mark.parametrize("idx", [9, 255])
def test_i_above_n_coins(bob, swap, idx):
    with brownie.reverts():
        swap.swap(idx, 0, 0, 0, chain.time() + 60, {"from": bob})


# TBD: How to force negative integer passed?
#
#@pytest.mark.parametrize("idx", [-1, -(2 ** 127)])
#def test_j_below_zero(bob, swap, idx):
#    with brownie.reverts():
#        swap.swap(0, idx, 0, 0, chain.time() + 60, {"from": bob})


@pytest.mark.parametrize("idx", [9, 255])
def test_j_above_n_coins(bob, swap, idx):
    with brownie.reverts():
        swap.swap(0, idx, 0, 0, chain.time() + 60, {"from": bob})


def test_nonpayable(swap, bob):
    with brownie.reverts():
        swap.swap(0, 1, 0, 0, chain.time() + 60, {"from": bob, "value": "1 ether"})
