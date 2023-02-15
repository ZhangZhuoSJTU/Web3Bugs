from itertools import combinations_with_replacement
from brownie import chain
import pytest
from pytest import approx

pytestmark = pytest.mark.usefixtures("add_initial_liquidity", "approve_bob")


@pytest.mark.itercoins("sending", "receiving")
@pytest.mark.parametrize("fee,admin_fee", combinations_with_replacement([0, 0.004, 0.001337, 0.005], 2))
def test_exchange(
    bob,
    swap,
    coins,
    sending,
    receiving,
    fee,
    admin_fee,
    decimals,
    base_amount,
    get_admin_balances,
):
    if fee or admin_fee:
        swap.setSwapFee(fee * 10 ** 10)
        swap.setAdminFee(admin_fee * 10 ** 10)

    amount = 10 ** decimals[sending]
    coins[sending]._mint_for_testing(bob, amount, {"from": bob})

    swap.swap(sending, receiving, amount, 0, chain.time() + 60, {"from": bob})

    assert coins[sending].balanceOf(bob) == 0

    received = coins[receiving].balanceOf(bob)
    assert (
        1 - max(1e-4, 1 / received) - fee < received / 10 ** decimals[receiving] < 1 - fee
    )

    expected_admin_fee = 10 ** decimals[receiving] * fee * admin_fee
    admin_fees = get_admin_balances()

    if expected_admin_fee >= 1:
        assert expected_admin_fee / admin_fees[receiving] == approx(
            1, rel=max(1e-3, 1 / (expected_admin_fee - 1.1))
        )
    else:
        assert admin_fees[receiving] <= 1


@pytest.mark.itercoins("sending", "receiving")
def test_min_dy(bob, swap, coins, sending, receiving, decimals, base_amount):
    amount = 10 ** decimals[sending]
    coins[sending]._mint_for_testing(bob, amount, {"from": bob})
    
    min_dy = swap.calculateSwap(sending, receiving, amount)
    swap.swap(sending, receiving, amount, min_dy - 1, chain.time() + 60, {"from": bob})

    received = coins[receiving].balanceOf(bob)

    assert abs(received - min_dy) <= 1
