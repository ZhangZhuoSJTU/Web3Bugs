import pytest

pytestmark = pytest.mark.usefixtures("mintAlice")


def test_approval(coin, bob, alice, initialAmount):
    coin.approve(bob, initialAmount, {"from": alice})
    assert coin.allowance(alice, bob) == initialAmount


def test_transfer(coin, bob, alice, initialAmount):
    coin.transfer(bob, initialAmount, {"from": alice})
    assert coin.balanceOf(bob) == initialAmount
    assert coin.balanceOf(alice) == 0
