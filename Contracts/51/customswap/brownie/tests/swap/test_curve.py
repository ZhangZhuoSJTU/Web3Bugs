from collections import deque
from itertools import permutations

import pytest
from brownie.test import given, strategy
from hypothesis import settings
from models import Curve
from conftest import MIN_RAMP_TIME


@given(
    st_pct=strategy("decimal[50]", min_value="0.001", max_value=1, unique=True, places=3),
    st_seed_amount=strategy("decimal", min_value=5, max_value=12, places=1),
    st_A=strategy("uint", min_value=0, max_value=2)
)
@settings(max_examples=5)
def test_curve_in_contract(
    chain,
    admin,
    alice,
    swap_1,
    swap_10,
    swap_100,
    swap_1000,
    swap_utils,
    coins,
    decimals,
    n_coins,
    approx,
    st_seed_amount,
    st_pct,
    st_A
):
    swap = [swap_1, swap_10, swap_100, swap_1000][st_A]
    A = [1, 10, 100, 1000][st_A]

    st_seed_amount = int(10 ** st_seed_amount)

    # add initial pool liquidity
    # we add at an imbalance of +10% for each subsequent coin
    initial_liquidity = []
    for coin, _decimals in zip(coins, decimals):
        amount = st_seed_amount * 10 ** _decimals + 1
        coin._mint_for_testing(alice, amount, {"from": alice})
        assert coin.balanceOf(alice) >= amount
        initial_liquidity.append(amount // 10)
        coin.approve(swap, amount // 10, {"from": alice})

    swap.addLiquidity(initial_liquidity, 0, chain.time() + 60, {"from": alice})

    # initialize our python model using the same parameters as the contract
    balances = [swap.getTokenBalance(i) for i in range(n_coins)]
    rates = []
    for coin, _decimals in zip(coins, decimals):
        rate = 10 ** 18
        precision = 10 ** (18 - _decimals)
        rates.append(rate * precision)

    curve_model = Curve(A, balances, n_coins, rates)

    # execute a series of swaps and compare the python model to the contract results
    exchange_pairs = deque(permutations(range(n_coins), 2))

    while st_pct:
        exchange_pairs.rotate()
        send, recv = exchange_pairs[0]

        dx = int(2 * st_seed_amount * 10 ** decimals[send] * st_pct.pop())
        dy_1 = swap.calculateSwap(send, recv, dx)
        dy_2 = curve_model.dy(send, recv, dx * (10 ** (18 - decimals[send])))
        dy_2 //= 10 ** (18 - decimals[recv])

        assert approx(dy_1, dy_2, 1e-8) or abs(dy_1 - dy_2) <= 2
