from brownie import chain, reverts
from brownie.test import given, strategy
from conftest import ONE_DAY, ONE_YEAR, approx


@given(
    isRevokable=strategy("bool")
)
def test_one_vesting(admin, ben, base_amount, token, vesting, isRevokable):
    vesting.vest(ben, base_amount, 1 if isRevokable else 0, {"from": admin})
    chain.sleep(ONE_YEAR)
    vesting.claim({"from": ben})
    assert approx(token.balanceOf(ben), base_amount)


def test_one_vesting_redundant_claim(admin, ben, base_amount, token, vesting):
    vesting.vest(ben, base_amount, 0, {"from": admin})
    chain.sleep(ONE_YEAR // 2)
    vesting.claim({"from": ben})
    with reverts():
        vesting.claim({"from": ben})
    chain.sleep(ONE_YEAR // 2)
    vesting.claim({"from": ben})
    assert approx(token.balanceOf(ben), base_amount)


@given(
    isRevokable1=strategy("bool"),
    isRevokable2=strategy("bool"),
    isRevokable3=strategy("bool")
)
def test_parallel_one_claim(admin, ben, base_amount, token, vesting, isRevokable1, isRevokable2, isRevokable3):
    vesting.vest(ben, base_amount, 1 if isRevokable1 else 0, {"from": admin})
    vesting.vest(ben, base_amount, 1 if isRevokable2 else 0, {"from": admin})
    vesting.vest(ben, base_amount, 1 if isRevokable3 else 0, {"from": admin})

    chain.sleep(ONE_YEAR)
    vesting.claim({"from": ben})
    assert approx(token.balanceOf(ben), 3 * base_amount)


@given(
    isRevokable=strategy("bool"),
)
def test_two_claims(admin, ben, base_amount, token, vesting, isRevokable):
    vesting.vest(ben, base_amount, 1 if isRevokable else 0, {"from": admin})

    chain.sleep(ONE_YEAR // 2)
    vesting.claim({"from": ben})

    chain.sleep(ONE_YEAR)
    vesting.claim({"from": ben})

    assert approx(token.balanceOf(ben), base_amount)


@given(
    isRevokable1=strategy("bool"),
    isRevokable2=strategy("bool"),
    isRevokable3=strategy("bool")
)
def test_parallel_multi_claim(admin, ben, base_amount, token, vesting, isRevokable1, isRevokable2, isRevokable3):
    vesting.vest(ben, base_amount, 1 if isRevokable1 else 0, {"from": admin})
    vesting.vest(ben, base_amount, 1 if isRevokable2 else 0, {"from": admin})
    vesting.vest(ben, base_amount, 1 if isRevokable3 else 0, {"from": admin})

    chain.sleep(ONE_YEAR // 3)
    vesting.claim({"from": ben})

    chain.sleep(ONE_YEAR // 3)
    vesting.claim({"from": ben})

    chain.sleep(ONE_YEAR // 3)
    chain.sleep(2 * ONE_DAY) # fudge
    vesting.claim({"from": ben})

    assert approx(token.balanceOf(ben), 3 * base_amount)


@given(
    N1=strategy("uint", min_value=2, max_value=5),
    N2=strategy("uint", min_value=2, max_value=4),
    N3=strategy("uint", min_value=2, max_value=3),
    isRevokable1=strategy("bool"),
    isRevokable2=strategy("bool"),
    isRevokable3=strategy("bool"),
    multiClaim=strategy("bool")
)
def test_staggered_multi_claim(admin, ben, base_amount, token, vesting, N1, N2, N3, isRevokable1, isRevokable2, isRevokable3, multiClaim):
    if N1 == N2 or N1 == N3 or N2 == N3:
        return

    t0 = chain.time()
    t = [
        t0,
        t0 + ONE_YEAR // N1,
        t0 + ONE_YEAR // N2,
        t0 + ONE_YEAR // N3
    ]
    t.sort()

    tVested = t0 + 2 * ONE_YEAR # catch all

    vesting.vest(ben, base_amount, 1 if isRevokable1 else 0, {"from": admin})
    chain.sleep(t[1] - t[0])
    if multiClaim:
        vesting.claim({"from": ben})

    vesting.vest(ben, base_amount, 1 if isRevokable2 else 0, {"from": admin})
    chain.sleep(t[2] - t[1])
    if multiClaim:
        vesting.claim({"from": ben})

    vesting.vest(ben, base_amount, 1 if isRevokable3 else 0, {"from": admin})
    chain.sleep(t[3] - t[2])
    if multiClaim:
        vesting.claim({"from": ben})

    chain.sleep(tVested - t[3])
    
    chain.sleep(ONE_DAY) # fudge

    vesting.claim({"from": ben})

    assert approx(token.balanceOf(ben), 3 * base_amount)


def test_two_parallel_multi_claims(admin, alice, ben, base_amount, token, vesting):
    vesting.vest(ben, base_amount, 0, {"from": admin})
    vesting.vest(alice, base_amount, 0, {"from": admin})
    vesting.vest(ben, base_amount, 0, {"from": admin})
    vesting.vest(alice, base_amount, 0, {"from": admin})
    vesting.vest(ben, base_amount, 0, {"from": admin})
    vesting.vest(alice, base_amount, 0, {"from": admin})

    chain.sleep(ONE_YEAR // 6)
    vesting.claim({"from": ben})
    chain.sleep(ONE_YEAR // 6)
    vesting.claim({"from": alice})

    chain.sleep(ONE_YEAR // 6)
    vesting.claim({"from": ben})
    chain.sleep(ONE_YEAR // 6)
    vesting.claim({"from": alice})

    chain.sleep(ONE_YEAR // 3)
    chain.sleep(2 * ONE_DAY) # fudge
    vesting.claim({"from": ben})
    vesting.claim({"from": alice})

    assert approx(token.balanceOf(ben), 3 * base_amount)
    assert approx(token.balanceOf(alice), 3 * base_amount)
