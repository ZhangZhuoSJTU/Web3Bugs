import pytest
from support.utils import scale
from brownie import chain

@pytest.mark.usefixtures("setUpStrategyForVault")
def test_deposit(admin, vault, decimals, strategy):
    vault.prepareTargetAllocation(scale(0.8, 18), {"from": admin})
    chain.sleep(3 * 86400)
    vault.executeTargetAllocation()
    admin.transfer(vault, scale(10, decimals))
    assert vault.balance() == scale(10, decimals)
    assert strategy.balance() == 0
    vault.deposit({"from": admin})
    assert pytest.approx(vault.balance()) == scale(2, decimals)
    assert pytest.approx(strategy.balance()) == scale(8, decimals)


def test_withdraw(admin, vault, decimals, pool):
    vault.prepareTargetAllocation(scale(0.8, 18), {"from": admin})
    chain.sleep(3 * 86400)
    vault.executeTargetAllocation()
    admin.transfer(vault, scale(10, decimals))
    vault.deposit({"from": admin})
    poolBalance = pool.balance()
    tx = vault.withdraw(scale(20, decimals), {"from": admin})
    assert tx.return_value == False
    assert pool.balance() == poolBalance
    tx = vault.withdraw(scale(10, decimals), {"from": admin})
    assert tx.return_value == True
    assert pool.balance() - poolBalance == scale(10, decimals)
    tx = vault.withdraw(scale(10, decimals), {"from": admin})
    assert tx.return_value == False

def test_withdraw_all(admin, vault, decimals, pool):
    vault.prepareTargetAllocation(scale(0.8, 18), {"from": admin})
    chain.sleep(3 * 86400)
    vault.executeTargetAllocation()
    admin.transfer(vault, scale(10, decimals))
    vault.deposit({"from": admin})
    poolBalance = pool.balance()
    vault.withdrawAll({"from": admin})
    assert vault.balance() == 0
    assert pool.balance() - poolBalance == scale(10, decimals)

@pytest.mark.usefixtures("setUpStrategyForVault")
def test_withdraw_from_strategy(admin, vault, decimals, strategy):
    vault.prepareTargetAllocation(scale(0.8, 18), {"from": admin})
    chain.sleep(3 * 86400)
    vault.executeTargetAllocation()
    admin.transfer(vault, scale(10, decimals))
    assert vault.balance() == scale(10, decimals)
    assert strategy.balance() == 0
    vault.deposit({"from": admin})
    assert pytest.approx(vault.balance()) == scale(2, decimals)
    assert pytest.approx(strategy.balance()) == scale(8, decimals)
    tx = vault.withdrawFromStrategy(scale(20, decimals), {"from": admin})
    assert tx.return_value == False
    assert pytest.approx(vault.balance()) == scale(2, decimals)
    assert pytest.approx(strategy.balance()) == scale(8, decimals)
    assert strategy.balance() > scale(5, decimals)
    tx = vault.withdrawFromStrategy(scale(5, decimals), {"from": admin})
    assert tx.return_value == True
    assert pytest.approx(vault.balance()) == scale(7, decimals)
    tx = vault.withdrawFromStrategy(scale(10, decimals), {"from": admin})
    assert tx.return_value == False
    assert pytest.approx(vault.balance()) == scale(7, decimals)

@pytest.mark.usefixtures("setUpStrategyForVault")
def test_withdraw_all_from_strategy(admin, vault, decimals):
    vault.prepareTargetAllocation(scale(0.8, 18), {"from": admin})
    chain.sleep(3 * 86400)
    vault.executeTargetAllocation()
    admin.transfer(vault, scale(10, decimals))
    vault.deposit({"from": admin})
    tx = vault.withdrawAllFromStrategy({"from": admin})
    assert tx.return_value == True
    assert vault.balance() == scale(10, decimals)
    assert vault.strategyActive() == False
