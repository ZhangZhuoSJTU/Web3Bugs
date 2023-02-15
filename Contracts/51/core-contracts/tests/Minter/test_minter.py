import itertools

import brownie
import pytest
from tests.conftest import WEEK, advance_epochs

TYPE_WEIGHTS = [5e17, 1e19]
GAUGE_WEIGHTS = [1e19, 1e18, 5e17]
GAUGE_TYPES = [0, 0, 1]

MONTH = 86400 * 30


@pytest.fixture(scope="module", autouse=True)
def gauge_setup(admin, alice, bob, mock_lp_token, gauge_controller, three_gauges, chain):
    # ensure the tests all begin at the start of the epoch week
    chain.mine(timestamp=(chain.time() / WEEK + 1) * WEEK)

    # set types
    for weight in TYPE_WEIGHTS:
        gauge_controller.add_type(b"Liquidity", weight, {"from": admin})

    # add gauges
    for i in range(3):
        gauge_controller.add_gauge(
            three_gauges[i], GAUGE_TYPES[i], GAUGE_WEIGHTS[i], {"from": admin}
        )

    # transfer tokens
    mock_lp_token.transfer(alice, 1e18, {"from": admin})
    mock_lp_token.transfer(bob, 1e18, {"from": admin})

    # approve gauges
    for gauge, acct in itertools.product(three_gauges, [alice, bob]):
        mock_lp_token.approve(gauge, 1e18, {"from": acct})


def test_mint(alice, three_gauges, minter, token):
    three_gauges[0].deposit(1e18, {"from": alice})

    advance_epochs(4, token)
    minter.mint(three_gauges[0], {"from": alice})
    assert token.balanceOf(alice) > 0

    expected = three_gauges[0].integrate_fraction(alice)

    assert expected > 0
    assert token.balanceOf(alice) == expected
    assert minter.minted(alice, three_gauges[0]) == expected


def test_mint_immediate(alice, chain, three_gauges, minter, token):
    three_gauges[0].deposit(1e18, {"from": alice})
    t0 = chain.time()
    chain.sleep((t0 + WEEK) // WEEK * WEEK - t0 + 1)  # 1 second more than enacting the weights

    minter.mint(three_gauges[0], {"from": alice})
    balance = token.balanceOf(alice)

    assert balance > 0
    assert minter.minted(alice, three_gauges[0]) == balance


def test_mint_multiple_same_gauge(alice, chain, three_gauges, minter, token):
    three_gauges[0].deposit(1e18, {"from": alice})

    advance_epochs(4, token)
    minter.mint(three_gauges[0], {"from": alice})
    balance = token.balanceOf(alice)

    advance_epochs(4, token)
    minter.mint(three_gauges[0], {"from": alice})
    expected = three_gauges[0].integrate_fraction(alice)
    final_balance = token.balanceOf(alice)

    assert final_balance > balance
    assert final_balance == expected
    assert minter.minted(alice, three_gauges[0]) == expected


def test_mint_multiple_gauges(alice, chain, three_gauges, minter, token):
    for i in range(3):
        three_gauges[i].deposit((i + 1) * 10 ** 17, {"from": alice})

    advance_epochs(4, token)

    for i in range(3):
        minter.mint(three_gauges[i], {"from": alice})

    total_minted = 0
    for i in range(3):
        gauge = three_gauges[i]
        minted = minter.minted(alice, gauge)
        assert minted == gauge.integrate_fraction(alice)
        total_minted += minted

    assert token.balanceOf(alice) == total_minted


def test_mint_after_withdraw(alice, chain, three_gauges, minter, token):
    three_gauges[0].deposit(1e18, {"from": alice})

    advance_epochs(2, token)
    three_gauges[0].withdraw(1e18, {"from": alice})
    minter.mint(three_gauges[0], {"from": alice})

    assert token.balanceOf(alice) > 0


def test_mint_multiple_after_withdraw(alice, chain, three_gauges, minter, token):
    three_gauges[0].deposit(1e18, {"from": alice})

    chain.sleep(10)
    three_gauges[0].withdraw(1e18, {"from": alice})
    minter.mint(three_gauges[0], {"from": alice})
    balance = token.balanceOf(alice)

    chain.sleep(10)
    minter.mint(three_gauges[0], {"from": alice})

    assert token.balanceOf(alice) == balance


def test_no_deposit(alice, chain, three_gauges, minter, token):
    minter.mint(three_gauges[0], {"from": alice})

    assert token.balanceOf(alice) == 0
    assert minter.minted(alice, three_gauges[0]) == 0


def test_mint_wrong_gauge(alice, chain, three_gauges, minter, token):
    three_gauges[0].deposit(1e18, {"from": alice})

    advance_epochs(4, token)
    minter.mint(three_gauges[1], {"from": alice})

    assert token.balanceOf(alice) == 0
    assert minter.minted(alice, three_gauges[0]) == 0
    assert minter.minted(alice, three_gauges[1]) == 0


def test_mint_not_a_gauge(admin, alice, minter):
    with brownie.reverts("dev: gauge is not added"):
        minter.mint(alice, {"from": admin})


def test_mint_before_inflation_begins(alice, chain, three_gauges, minter, token):
    three_gauges[0].deposit(1e18, {"from": alice})

    chain.sleep(token.start_epoch_time() - chain.time() - 5)
    minter.mint(three_gauges[0], {"from": alice})

    assert token.balanceOf(alice) == 0
    assert minter.minted(alice, three_gauges[0]) == 0
