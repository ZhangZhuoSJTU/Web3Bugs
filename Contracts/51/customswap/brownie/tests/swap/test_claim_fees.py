import brownie
import pytest


@pytest.fixture(scope="module", autouse=True)
def setup(swap_utils, alice, add_initial_liquidity, mint_bob, approve_bob, swap):
    swap.setSwapFee(swap_utils.MAX_SWAP_FEE())
    swap.setAdminFee(swap_utils.MAX_ADMIN_FEE())


def test_fee_too_high(swap, swap_utils):
    with brownie.reverts("Fee is too high"):
        swap.setSwapFee(1 + swap_utils.MAX_SWAP_FEE())
    with brownie.reverts("Fee is too high"):
        swap.setAdminFee(1 + swap_utils.MAX_ADMIN_FEE())


def test_swap_too_late(chain, swap, bob, initial_amounts):
    with brownie.reverts("Deadline not met"):
        swap.swap(0, 1, initial_amounts[0], 0, chain.time() - 1, {"from": bob})


def test_admin_balances(chain, alice, bob, swap, coins, initial_amounts):
    for send, recv in [(0, 1), (1, 0)]:
        swap.swap(send, recv, initial_amounts[send], 0, chain.time() + 60, {"from": bob})

    for i in (0, 1):
        admin_fee = coins[i].balanceOf(swap) - swap.getTokenBalance(i)
        assert admin_fee + swap.getTokenBalance(i) == coins[i].balanceOf(swap)
        assert admin_fee > 0


def test_withdraw_one_coin(chain, admin, bob, swap, coins, initial_amounts, get_admin_balances):
    sending = 0
    receiving = 1

    swap.swap(sending, receiving, initial_amounts[sending], 0, chain.time() + 60, {"from": bob})

    admin_balances = get_admin_balances()

    assert admin_balances[receiving] > 0
    assert sum(admin_balances) == admin_balances[receiving]

    swap.withdrawAdminFees({"from": admin})

    assert coins[receiving].balanceOf(admin) == admin_balances[receiving]
    assert swap.getTokenBalance(receiving) == coins[receiving].balanceOf(swap)


def test_withdraw_all_coins(chain, admin, bob, swap, coins, initial_amounts, get_admin_balances, n_coins):
    for send, recv in zip(range(n_coins), list(range(1, n_coins)) + [0]):
        swap.swap(send, recv, initial_amounts[send], 0, chain.time() + 60, {"from": bob})

    admin_balances = get_admin_balances()

    swap.withdrawAdminFees({"from": admin})

    for balance, coin in zip(admin_balances, coins):
        assert coin.balanceOf(admin) == balance


def test_withdraw_only_owner(bob, swap):
    with brownie.reverts():
        swap.withdrawAdminFees({"from": bob})
