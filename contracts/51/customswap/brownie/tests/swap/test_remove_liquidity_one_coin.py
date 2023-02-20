import brownie
import pytest
from brownie import chain

pytestmark = [
    pytest.mark.usefixtures("add_initial_liquidity"),
]


@pytest.mark.itercoins("idx")
@pytest.mark.parametrize("rate_mod", [0.9, 0.99, 1.01, 1.1])
def test_amount_received(chain, alice, initial_amounts, swap, coins, decimals, liquidity, idx, rate_mod):
    liquidity.approve(swap, initial_amounts[idx], {"from": alice})
    swap.removeLiquidityOneToken(initial_amounts[idx], idx, 0, chain.time() + 60, {"from": alice})
    balance = coins[idx].balanceOf(alice)
    assert 10 ** decimals[idx] // rate_mod <= balance <= initial_amounts[idx]


@pytest.mark.itercoins("idx")
@pytest.mark.parametrize("divisor", [42, 5, 2])
def test_lp_token_balance(alice, swap, liquidity, initial_amounts, n_coins, base_amount, idx, divisor):
    amount = liquidity.balanceOf(alice) // divisor
    liquidity.approve(swap, amount, {"from": alice})
    swap.removeLiquidityOneToken(amount, idx, 0, chain.time() + 60, {"from": alice})
    assert liquidity.balanceOf(alice) == n_coins * base_amount * 10 ** 18 - amount


@pytest.mark.itercoins("idx")
@pytest.mark.parametrize("rate_mod", [0.9, 1.1])
def test_expected_vs_actual(
    chain, alice, swap, coins, liquidity, n_coins, idx, rate_mod, base_amount
):
    amount = liquidity.balanceOf(alice) // 10
    expected = swap.calculateRemoveLiquidityOneToken(alice, amount, idx)
    liquidity.approve(swap, amount, {"from": alice})
    swap.removeLiquidityOneToken(amount, idx, 0, chain.time() + 60, {"from": alice})
    assert coins[idx].balanceOf(alice) == expected
    assert liquidity.balanceOf(alice) == n_coins * 10 ** 18 * base_amount - amount


@pytest.mark.itercoins("idx")
def test_amount_exceeds_balance(bob, swap, coins, liquidity, idx):
    with brownie.reverts():
        swap.removeLiquidityOneToken(1, idx, 0, chain.time() + 60, {"from": bob})


def test_above_n_coins(alice, swap, coins, n_coins):
    with brownie.reverts():
        swap.removeLiquidityOneToken(1, n_coins, 0, chain.time() + 60, {"from": alice})


@pytest.mark.itercoins("idx")
def test_event(alice, bob, swap, liquidity, idx, coins):
    amount = 10 ** 18
    liquidity.transfer(bob, amount, {"from": alice})
    liquidity.approve(swap, amount, {"from": bob})
    tx = swap.removeLiquidityOneToken(amount, idx, 0, chain.time() + 60, {"from": bob})

    event = tx.events["RemoveLiquidityOne"]
    assert event["provider"] == bob
    assert event["lpTokenAmount"] == 10 ** 18

    coin = coins[idx]
    assert coin.balanceOf(bob) == event["tokensBought"]


def test_cannot_remove_all_sparse_liquidity_in_one_coin(alice, swap, liquidity):
    amount = liquidity.balanceOf(alice)
    assert amount == liquidity.totalSupply()
    liquidity.approve(swap, amount, {"from": alice})
    with brownie.reverts():
        swap.removeLiquidityOneToken(amount, 0, 0, chain.time() + 60, {"from": alice})


def test_can_remove_all_liquidity_share_in_one_coin(alice, bob, mint_bob, approve_bob, swap, coins, liquidity, initial_amounts):
    swap.addLiquidity(initial_amounts, 0, chain.time() + 60, {"from": bob})
    amount = liquidity.balanceOf(bob)
    assert amount < liquidity.totalSupply()
    liquidity.approve(swap, amount, {"from": bob})
    swap.removeLiquidityOneToken(amount, 0, 0, chain.time() + 60, {"from": bob})
    assert liquidity.balanceOf(bob) == 0
    assert coins[0].balanceOf(bob) < amount