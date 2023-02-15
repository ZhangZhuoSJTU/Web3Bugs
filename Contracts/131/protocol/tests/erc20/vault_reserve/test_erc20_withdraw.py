from brownie.test.managers.runner import RevertContextManager as reverts
import pytest
from brownie import MockErc20


@pytest.fixture(scope="module")
def setUpReserve(vault, coin, decimals, admin, pool):
    coin.mint_for_testing(vault, 10**decimals)
    vault.depositToReserve(coin, 10**decimals, {"from": admin})
    pool.setVault(vault, {"from": admin})


pytestmark = pytest.mark.usefixtures("setUpReserve")


def test_reserve_withdraw(vaultReserve, vault, coin, decimals, admin, chain):
    amount = 0.5 * 10**decimals
    vault.withdrawFromReserve(coin, amount, {"from": admin})
    assert coin.balanceOf(vault) == amount

    with reverts("Reserve access exceeded"):
        vault.withdrawFromReserve(coin, amount, {"from": admin})

    chain.sleep(vaultReserve.minWithdrawalDelay())
    vault.withdrawFromReserve(coin, amount, {"from": admin})
    assert coin.balanceOf(vault) == 2 * amount


def test_reserve_withdraw_reverts(admin, vault, coin, decimals):
    with reverts("insufficient balance"):
        vault.withdrawFromReserve(coin, 2 * 10**decimals, {"from": admin})


def test_reserve_withdraw_multiple_coins(
    vaultReserve, admin, vault, coin, decimals, chain
):
    assert coin.balanceOf(vault) == 0
    amount = 10**6
    mockCoin = admin.deploy(MockErc20, 6)
    mockCoin.mint_for_testing(vault, amount)
    vault.depositToReserve(mockCoin, amount, {"from": admin})
    vault.withdrawFromReserve(mockCoin, 0.5 * amount, {"from": admin})
    assert mockCoin.balanceOf(vaultReserve) == 0.5 * amount
    assert mockCoin.balanceOf(vault) == 0.5 * amount
    chain.sleep(vaultReserve.minWithdrawalDelay())
    vault.withdrawFromReserve(coin, 10**decimals, {"from": admin})
    assert coin.balanceOf(vault) == 10**decimals
    assert coin.balanceOf(vaultReserve) == 0
