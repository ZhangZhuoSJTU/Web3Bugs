from brownie import reverts

from support.utils import scale


def test_cap(alice, decimals, cappedPool):
    cappedPool.deposit(
        scale(10, decimals), {"from": alice, "value": scale(10, decimals)}
    )
    cappedPool.deposit(
        scale(10, decimals), {"from": alice, "value": scale(10, decimals)}
    )
    with reverts("deposit exceeds deposit cap"):
        cappedPool.deposit(
            scale(10, decimals), {"from": alice, "value": scale(10, decimals)}
        )


def test_uncap(alice, decimals, cappedPool, admin):
    cappedPool.uncap({"from": admin})
    cappedPool.deposit(
        scale(30, decimals), {"from": alice, "value": scale(30, decimals)}
    )


def test_updated_capped_limit(alice, decimals, cappedPool, admin):
    cappedPool.updateDepositCap(scale(40, decimals), {"from": admin})
    cappedPool.deposit(
        scale(30, decimals), {"from": alice, "value": scale(30, decimals)}
    )
    with reverts("deposit exceeds deposit cap"):
        cappedPool.deposit(
            scale(30, decimals), {"from": alice, "value": scale(30, decimals)}
        )
