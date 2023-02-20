import brownie
import pytest
from brownie import chain

pytestmark = pytest.mark.usefixtures("add_initial_liquidity")


@pytest.mark.parametrize("min_amount", (0, 1))
def test_remove_liquidity(
    alice, swap, coins, liquidity, min_amount, initial_amounts, base_amount, n_coins
):
    liquidity.approve(swap, n_coins * 10 ** 18 * base_amount, {"from": alice})
    swap.removeLiquidity(
        n_coins * 10 ** 18 * base_amount,
        [i * min_amount for i in initial_amounts], 
        chain.time() + 60,
        {"from": alice}
    )

    for coin, amount in zip(coins, initial_amounts):
        assert coin.balanceOf(alice) == amount
        assert coin.balanceOf(swap) == 0

    assert liquidity.balanceOf(alice) == 0
    assert liquidity.totalSupply() == 0


def test_remove_partial(
    alice, swap, coins, liquidity, initial_amounts, base_amount, n_coins
):
    withdraw_amount = sum(initial_amounts) // 2
    liquidity.approve(swap, withdraw_amount, {"from": alice})
    swap.removeLiquidity(withdraw_amount, [0] * n_coins, chain.time() + 60, {"from": alice})

    for coin, amount in zip(coins, initial_amounts):
        pool_balance = coin.balanceOf(swap)
        alice_balance = coin.balanceOf(alice)
        assert alice_balance + pool_balance == amount

    assert liquidity.balanceOf(alice) == n_coins * 10 ** 18 * base_amount - withdraw_amount
    assert liquidity.totalSupply() == n_coins * 10 ** 18 * base_amount - withdraw_amount


@pytest.mark.itercoins("idx")
def test_below_min_amount(alice, swap, initial_amounts, base_amount, n_coins, idx):
    min_amount = initial_amounts.copy()
    min_amount[idx] += 1

    with brownie.reverts():
        swap.removeLiquidity(n_coins * 10 ** 18 * base_amount, min_amount, chain.time() + 60, {"from": alice})


def test_amount_exceeds_balance(alice, swap, n_coins, base_amount):
    with brownie.reverts():
        swap.removeLiquidity(n_coins * 10 ** 18 * base_amount + 1, [0] * n_coins, chain.time() + 60, {"from": alice})


def test_event(alice, bob, swap, coins, liquidity, n_coins):
    liquidity.transfer(bob, 10 ** 18, {"from": alice})
    liquidity.approve(swap, 10 ** 18, {"from": bob})
    tx = swap.removeLiquidity(10 ** 18, [0] * n_coins, chain.time() + 60, {"from": bob})

    event = tx.events["RemoveLiquidity"]
    assert event["provider"] == bob
    assert event["lpTokenSupply"] == liquidity.totalSupply()
    for coin, amount in zip(coins, event["tokenAmounts"]):
        assert coin.balanceOf(bob) == amount
