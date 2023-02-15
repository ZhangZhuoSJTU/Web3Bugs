import pytest

pytestmark = pytest.mark.usefixtures("add_initial_liquidity")


def test_unexpected_coin(swap, admin, get_admin_balances, coins):
    virtual_price = swap.getVirtualPrice()

    coins[-1]._mint_for_testing(swap, 123456, {"from": admin})

    assert swap.getVirtualPrice() == virtual_price
    assert sum(get_admin_balances()) == 123456
