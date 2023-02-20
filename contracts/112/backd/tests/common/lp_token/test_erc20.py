import brownie
import pytest


pytestmark = pytest.mark.usefixtures("mintLpAlice")


def test_balance_of(alice, lpToken, initialAmount):
    assert lpToken.balanceOf(alice) == initialAmount


def test_transfer(alice, bob, pool, lpToken, initialAmount):
    lpToken.approve(pool, initialAmount, {"from": alice})
    assert lpToken.allowance(alice, pool) == initialAmount

    lpToken.transfer(bob, initialAmount, {"from": alice})
    assert lpToken.balanceOf(alice) == 0
    assert lpToken.balanceOf(bob) == initialAmount
    assert lpToken.allowance(alice, bob) == 0

    lpToken.transfer(alice, initialAmount, {"from": bob})
    assert lpToken.balanceOf(alice) == initialAmount


def test_transfer_zero(alice, bob, lpToken):
    # test to check if the _beforeTransfer hook breaks the OpenZeppelin Standard
    lpToken.transfer(bob, 0, {"from": alice})
    assert lpToken.balanceOf(bob) == 0
    lpToken.transferFrom(alice, bob, 0, {"from": bob})
    assert lpToken.balanceOf(bob) == 0


def test_transfer_fail(alice, bob, lpToken, initialAmount, decimals):
    assert lpToken.balanceOf(alice) == initialAmount
    lpToken.approve(bob, initialAmount + 10 ** decimals, {"from": alice})
    with brownie.reverts("ERC20: transfer amount exceeds balance"):
        lpToken.transferFrom(alice, bob, initialAmount + 10 ** decimals, {"from": bob})


def test_transfer_from_fail(alice, bob, charlie, lpToken, initialAmount):
    lpToken.approve(bob, initialAmount, {"from": alice})
    with brownie.reverts():
        lpToken.transferFrom(alice, bob, initialAmount, {"from": charlie})


def test_transfer_from(alice, lpToken, charlie, initialAmount):
    assert lpToken.balanceOf(charlie) == 0
    assert lpToken.allowance(alice, charlie) == 0

    with brownie.reverts("ERC20: insufficient allowance"):
        lpToken.transferFrom(alice, charlie, initialAmount, {"from": charlie})

    lpToken.approve(charlie, initialAmount, {"from": alice})
    lpToken.transferFrom(alice, charlie, initialAmount, {"from": charlie})
    assert lpToken.balanceOf(charlie) == initialAmount
    assert lpToken.balanceOf(alice) == 0
