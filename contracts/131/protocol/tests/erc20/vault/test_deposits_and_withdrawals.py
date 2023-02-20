import pytest
from support.utils import scale
from brownie import chain


@pytest.mark.usefixtures("setUpStrategyForVault")
def test_deposit(admin, vault, coin, decimals):
    vault.prepareTargetAllocation(scale(0.8, 18), {"from": admin})
    chain.sleep(3 * 86400)
    vault.executeTargetAllocation()
    coin.mint(scale(10, decimals), {"from": admin})
    coin.transfer(vault, scale(10, decimals), {"from": admin})
    assert coin.balanceOf(vault) == scale(10, decimals)
    strategy = vault.getStrategy()
    assert coin.balanceOf(strategy) == 0
    vault.deposit({"from": admin})
    assert pytest.approx(coin.balanceOf(vault)) == scale(2, decimals)
    assert pytest.approx(coin.balanceOf(strategy)) == scale(8, decimals)


def test_withdraw(admin, vault, coin, decimals, pool):
    vault.prepareTargetAllocation(scale(0.8, 18), {"from": admin})
    chain.sleep(3 * 86400)
    vault.executeTargetAllocation()
    coin.mint(scale(10, decimals), {"from": admin})
    coin.transfer(vault, scale(10, decimals), {"from": admin})
    vault.deposit({"from": admin})
    poolBalance = coin.balanceOf(pool)
    tx = vault.withdraw(scale(20, decimals), {"from": admin})
    assert tx.return_value == False
    assert coin.balanceOf(pool) == poolBalance
    tx = vault.withdraw(scale(10, decimals), {"from": admin})
    assert tx.return_value == True
    assert coin.balanceOf(pool) - poolBalance == scale(10, decimals)
    tx = vault.withdraw(scale(10, decimals), {"from": admin})
    assert tx.return_value == False


def test_withdraw_all(admin, vault, coin, decimals, pool):
    vault.prepareTargetAllocation(scale(0.8, 18), {"from": admin})
    chain.sleep(3 * 86400)
    vault.executeTargetAllocation()
    coin.mint(scale(10, decimals), {"from": admin})
    coin.transfer(vault, scale(10, decimals), {"from": admin})
    vault.deposit({"from": admin})
    poolBalance = coin.balanceOf(pool)
    vault.withdrawAll({"from": admin})
    assert coin.balanceOf(vault) == 0
    assert coin.balanceOf(pool) - poolBalance == scale(10, decimals)


@pytest.mark.usefixtures("setUpStrategyForVault")
def test_withdraw_from_strategy(admin, vault, coin, decimals):
    vault.prepareTargetAllocation(scale(0.8, 18), {"from": admin})
    chain.sleep(3 * 86400)
    vault.executeTargetAllocation()
    coin.mint(scale(10, decimals), {"from": admin})
    coin.transfer(vault, scale(10, decimals), {"from": admin})
    assert coin.balanceOf(vault) == scale(10, decimals)
    strategy = vault.getStrategy()
    assert coin.balanceOf(strategy) == 0
    vault.deposit({"from": admin})
    assert pytest.approx(coin.balanceOf(vault)) == scale(2, decimals)
    assert pytest.approx(coin.balanceOf(strategy)) == scale(8, decimals)
    tx = vault.withdrawFromStrategy(scale(20, decimals), {"from": admin})
    assert tx.return_value == False
    assert pytest.approx(coin.balanceOf(vault)) == scale(2, decimals)
    assert pytest.approx(coin.balanceOf(strategy)) == scale(8, decimals)
    assert coin.balanceOf(strategy) > scale(5, decimals)
    tx = vault.withdrawFromStrategy(scale(5, decimals), {"from": admin})
    assert tx.return_value == True
    assert pytest.approx(coin.balanceOf(vault)) == scale(7, decimals)
    tx = vault.withdrawFromStrategy(scale(10, decimals), {"from": admin})
    assert tx.return_value == False
    assert pytest.approx(coin.balanceOf(vault)) == scale(7, decimals)

@pytest.mark.usefixtures("setUpStrategyForVault")
def test_withdraw_all_from_strategy(admin, vault, coin, decimals):
    vault.prepareTargetAllocation(scale(0.8, 18), {"from": admin})
    chain.sleep(3 * 86400)
    vault.executeTargetAllocation()
    coin.mint(scale(10, decimals), {"from": admin})
    coin.transfer(vault, scale(10, decimals), {"from": admin})
    vault.deposit({"from": admin})
    tx = vault.withdrawAllFromStrategy({"from": admin})
    assert tx.return_value == True
    assert coin.balanceOf(vault) == scale(10, decimals)
    assert vault.strategyActive() == False
