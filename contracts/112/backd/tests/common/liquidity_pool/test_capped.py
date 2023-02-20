from brownie import reverts
from support.utils import scale


# Views
def test_is_not_capped_by_default(pool):
    assert pool.isCapped() == False


def test_capped_limit_is_0_by_default(pool):
    assert pool.depositCap() == 0


# Functions
def test_capped(cappedPool, decimals):
    assert cappedPool.isCapped() == True
    assert cappedPool.depositCap() == scale(20, decimals)


def test_uncap(admin, cappedPool):
    cappedPool.uncap({"from": admin})
    assert cappedPool.isCapped() == False


def test_update_capped_limit(admin, cappedPool, decimals):
    depositCap = scale(234, decimals)
    cappedPool.updateDepositCap(depositCap, {"from": admin})
    assert cappedPool.isCapped() == True
    assert cappedPool.depositCap() == depositCap


# Reverts
def test_revert_on_uncap_for_non_admin(cappedPool, decimals, alice):
    with reverts("unauthorized access"):
        cappedPool.uncap({"from": alice})


def test_revert_on_uncap_for_non_capped(admin, pool):
    with reverts("the pool is not currently capped"):
        pool.uncap({"from": admin})


def test_revert_on_update_capped_limit_for_not_capped(admin, pool, decimals):
    with reverts("the pool is not currently capped"):
        pool.updateDepositCap(scale(234, decimals), {"from": admin})


def test_revert_on_update_capped_limit_with_same_value(admin, cappedPool, decimals):
    with reverts("value must be different to existing value"):
        cappedPool.updateDepositCap(scale(20, decimals), {"from": admin})


def test_revert_on_update_capped_limit_with_0_value(admin, cappedPool, decimals):
    with reverts("invalid amount"):
        cappedPool.updateDepositCap(scale(0, decimals), {"from": admin})
