import pytest
from brownie.test import given, strategy

pytestmark = pytest.mark.usefixtures("add_initial_liquidity")


@given(which=strategy('uint', min_value=0, max_value=1))
def test_gift_changes_admin_balance(bob, swap, coins, n_coins, initial_amounts, which):
    for i in range(n_coins):
        assert swap.getAdminBalance(i) == 0

    # a gift?
    coins[which]._mint_for_testing(swap, initial_amounts[which], {"from": bob})

    for i in range(n_coins):
        assert swap.getAdminBalance(i) == (initial_amounts[which] if i == which else 0)


@given(which=strategy('uint', min_value=0, max_value=1))
def test_virtual_price_does_not_increases_with_gift(bob, swap, coins, initial_amounts, which):
    virtual_price = swap.getVirtualPrice()

    # a gift?
    coins[which]._mint_for_testing(swap, initial_amounts[which], {"from": bob})

    assert swap.getVirtualPrice() == virtual_price
