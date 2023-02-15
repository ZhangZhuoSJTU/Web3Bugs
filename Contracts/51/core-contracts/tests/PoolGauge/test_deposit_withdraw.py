import brownie
import pytest


@pytest.fixture(scope="module", autouse=True)
def deposit_setup(admin, pool_gauge, mock_lp_token):
    mock_lp_token.approve(pool_gauge, 2 ** 256 - 1, {"from": admin})


def test_deposit(admin, pool_gauge, mock_lp_token):
    balance = mock_lp_token.balanceOf(admin)
    pool_gauge.deposit(100000, {"from": admin})

    assert mock_lp_token.balanceOf(pool_gauge) == 100000
    assert mock_lp_token.balanceOf(admin) == balance - 100000
    assert pool_gauge.totalSupply() == 100000
    assert pool_gauge.balanceOf(admin) == 100000


def test_deposit_zero(admin, pool_gauge, mock_lp_token):
    balance = mock_lp_token.balanceOf(admin)
    pool_gauge.deposit(0, {"from": admin})

    assert mock_lp_token.balanceOf(pool_gauge) == 0
    assert mock_lp_token.balanceOf(admin) == balance
    assert pool_gauge.totalSupply() == 0
    assert pool_gauge.balanceOf(admin) == 0


def test_deposit_insufficient_balance(alice, pool_gauge, mock_lp_token):
    with brownie.reverts():
        pool_gauge.deposit(100000, {"from": alice})


def test_withdraw(admin, pool_gauge, mock_lp_token):
    balance = mock_lp_token.balanceOf(admin)

    pool_gauge.deposit(100000, {"from": admin})
    pool_gauge.withdraw(100000, {"from": admin})

    assert mock_lp_token.balanceOf(pool_gauge) == 0
    assert mock_lp_token.balanceOf(admin) == balance
    assert pool_gauge.totalSupply() == 0
    assert pool_gauge.balanceOf(admin) == 0


def test_withdraw_zero(admin, pool_gauge, mock_lp_token):
    balance = mock_lp_token.balanceOf(admin)
    pool_gauge.deposit(100000, {"from": admin})
    pool_gauge.withdraw(0, {"from": admin})

    assert mock_lp_token.balanceOf(pool_gauge) == 100000
    assert mock_lp_token.balanceOf(admin) == balance - 100000
    assert pool_gauge.totalSupply() == 100000
    assert pool_gauge.balanceOf(admin) == 100000


def test_withdraw_new_epoch(admin, chain, pool_gauge, mock_lp_token):
    balance = mock_lp_token.balanceOf(admin)

    pool_gauge.deposit(100000, {"from": admin})
    chain.sleep(86400 * 400)
    pool_gauge.withdraw(100000, {"from": admin})

    assert mock_lp_token.balanceOf(pool_gauge) == 0
    assert mock_lp_token.balanceOf(admin) == balance
    assert pool_gauge.totalSupply() == 0
    assert pool_gauge.balanceOf(admin) == 0
