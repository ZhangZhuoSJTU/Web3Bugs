from brownie import chain, reverts
from brownie.test import given, strategy
from conftest import ONE_DAY, ONE_YEAR, approx, sleep_from


def test_unrevokable(admin, ben, base_amount, token, vesting):
    vesting.vest(ben, base_amount, 0, {"from": admin})
    with reverts():
        vesting.revoke(ben)


def test_revokable(admin, ben, base_amount, token, vesting):
    tx = vesting.vest(ben, base_amount, 1, {"from": admin})
    sleep_from(tx, ONE_DAY)
    tx = vesting.revoke(ben)
    sleep_from(tx, ONE_YEAR)
    with reverts():
        vesting.claim({"from": ben})
    assert approx(token.balanceOf(ben), base_amount * ONE_DAY // ONE_YEAR)


def test_revokable_after_a_while(admin, ben, base_amount, token, vesting):
    tx0 = vesting.vest(ben, base_amount, 1, {"from": admin})
    sleep_from(tx0, ONE_YEAR // 2)
    tx1 = vesting.revoke(ben)
    assert approx(token.balanceOf(ben), base_amount // 2)
    sleep_from(tx1, ONE_DAY)
    with reverts():
        vesting.claim({"from": ben})
    assert approx(token.balanceOf(ben), base_amount // 2)


def test_revokable_after_claim(admin, ben, base_amount, token, vesting):
    tx0 = vesting.vest(ben, base_amount, 1, {"from": admin})
    sleep_from(tx0, ONE_YEAR // 2)
    tx1 = vesting.claim({"from": ben})
    chain.mine()
    assert approx(token.balanceOf(ben), base_amount // 2)
    tx2 = vesting.revoke(ben)
    assert approx(token.balanceOf(ben), base_amount * (tx2.timestamp - tx0.timestamp) // ONE_YEAR)
    with reverts():
        vesting.claim({"from": ben})


def test_revokable_after_a_while_after_claim(admin, ben, base_amount, token, vesting):
    tx = vesting.vest(ben, base_amount, 1, {"from": admin})
    sleep_from(tx, ONE_YEAR // 2)
    tx = vesting.claim({"from": ben})
    sleep_from(tx, ONE_YEAR // 2)
    assert approx(token.balanceOf(ben), base_amount // 2)
    vesting.revoke(ben)
    assert approx(token.balanceOf(ben), base_amount)
    with reverts():
        vesting.claim({"from": ben})


def test_revoked_address_is_reusable(admin, ben, base_amount, token, vesting):
    tx = vesting.vest(ben, base_amount, 1, {"from": admin})
    sleep_from(tx, ONE_DAY)
    tx = vesting.revoke(ben)
    sleep_from(tx, ONE_YEAR)
    with reverts():
        vesting.claim({"from": ben})
    assert approx(token.balanceOf(ben), base_amount * ONE_DAY // ONE_YEAR)

    # vest again with same address
    tx = vesting.vest(ben, base_amount, 1, {"from": admin})
    sleep_from(tx, ONE_YEAR)
    vesting.claim({"from": ben})
    assert approx(token.balanceOf(ben), base_amount + (base_amount * ONE_DAY // ONE_YEAR))
    