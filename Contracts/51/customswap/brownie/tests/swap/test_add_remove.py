import brownie
import pytest
from brownie import chain

@pytest.mark.itercoins("send", "receive")
def test_cannot_remove_more_than_added(add_initial_liquidity, bob, swap, coins, liquidity, decimals, n_coins, send, receive):
    coins[send].approve(swap, 2 ** 256 - 1, {"from": bob})
    liquidity.approve(swap, 2 ** 256 - 1, {"from": bob})

    amounts = [0] * n_coins
    amounts[send] = 10 ** decimals[send]

    coins[send]._mint_for_testing(bob, amounts[send], {"from": bob})

    swap.addLiquidity(amounts, 0, chain.time() + 60, {"from": bob})

    swap.removeLiquidityOneToken(liquidity.balanceOf(bob), receive, 0, chain.time() + 60, {"from": bob})

    assert coins[receive].balanceOf(bob) < amounts[send] 

    with brownie.reverts():
        swap.removeLiquidityOneToken(1, receive, 0, chain.time() + 60, {"from": bob})
