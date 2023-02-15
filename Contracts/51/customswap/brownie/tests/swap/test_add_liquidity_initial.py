import brownie
import pytest
from brownie.test import given, strategy
from conftest import MAX_UINT256

pytestmark = pytest.mark.usefixtures("mint_alice", "approve_alice")


def test_simple_add(alice, swap):
    swap.addLiquidity([1e3, 1e3],1e3 , MAX_UINT256, {"from": alice})


@pytest.mark.parametrize("min_amount", [0, 2 * 10 ** 18])
def test_initial(
    chain, alice, swap, coins, liquidity, min_amount, decimals, n_coins, initial_amounts
):
    amounts = [10 ** i for i in decimals]

    swap.addLiquidity(amounts, min_amount, chain.time() + 60, {"from": alice})

    for coin, amount, initial in zip(coins, amounts, initial_amounts):
        assert coin.balanceOf(alice) == initial - amount
        assert coin.balanceOf(swap) == amount

    assert liquidity.balanceOf(alice) == n_coins * 10 ** 18
    assert liquidity.totalSupply() == n_coins * 10 ** 18


@given(idx=strategy('uint', min_value=0, max_value=1))
def test_initial_liquidity_missing_coin(chain, alice, swap, liquidity, idx, decimals):
    amounts = [10 ** i for i in decimals]
    amounts[idx] = 0

    with brownie.reverts():
        swap.addLiquidity(amounts, 0, chain.time() + 60, {"from": alice})
