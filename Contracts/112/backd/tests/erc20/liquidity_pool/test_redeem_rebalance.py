import pytest
import brownie

from brownie.test import given, strategy

INITIAL_AMOUNT = 1000000


@given(
    lockRatio=strategy("decimal", min_value="0.01", max_value="0.99", places=2),
    requiredReserveRatio=strategy("decimal", min_value="0.01", max_value="1", places=2),
)
def test_redeem_rebalance_with_sufficient_pool_funds(
    lockRatio,
    requiredReserveRatio,
    stakerVault,
    admin,
    lpToken,
    topUpAction,
    pool,
    address_provider,
    vault,
    coin,
    alice,
    decimals,
):
    vault.setTargetAllocation(0)
    pool.setMinWithdrawalFee(0)
    pool.setMaxWithdrawalFee(0)
    pool.setMaxBackingReserveDeviationRatio(0)
    address_provider.addPool(pool, {"from": admin})
    amount = INITIAL_AMOUNT * 10 ** decimals
    coin.mint_for_testing(alice, amount)
    coin.approve(pool, amount, {"from": alice})
    pool.deposit(amount, {"from": alice})

    initialAmount = INITIAL_AMOUNT * 10 ** decimals
    lockedAmount = lockRatio * initialAmount
    unlockedAmount = initialAmount - lockedAmount
    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(vault) == initialAmount
    pool.setRequiredBackingReserveRatio(requiredReserveRatio * 10 ** 18)

    # we lock x% of initial liquidity for action
    lpToken.approve(stakerVault, lockedAmount, {"from": alice})
    stakerVault.stakeFor(topUpAction, lockedAmount, {"from": alice})

    # rebalance allocations
    pool.rebalanceVault({"from": admin})
    assert pool.exchangeRate() == 1e18
    assert stakerVault.getStakedByActions() == lockedAmount
    assert pytest.approx(coin.balanceOf(pool)) == (requiredReserveRatio * lockedAmount)
    assert pytest.approx(coin.balanceOf(vault)) == (
        (1 - requiredReserveRatio) * lockedAmount + unlockedAmount
    )

    pool.redeem(unlockedAmount, {"from": alice})
    assert pytest.approx(coin.balanceOf(pool)) == (requiredReserveRatio * lockedAmount)
    assert pytest.approx(coin.balanceOf(vault)) == (
        (1 - requiredReserveRatio) * lockedAmount
    )
