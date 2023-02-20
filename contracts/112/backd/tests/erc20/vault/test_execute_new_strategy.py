from re import L
import pytest
import brownie
from brownie import ZERO_ADDRESS, chain

from support.utils import scale
from support.constants import ADMIN_DELAY

MOCK_STRATEGY_ADDRESS = "0xDD17874f13666d44A3398D298b075B7a3505D8d4"

STRATEGY_DELAY = 5 * 86400


@pytest.fixture(scope="module")
def mockVault(
    Erc20Vault, pool, controller, mockStrategy, mockLockingStrategy, vaultReserve, admin
):
    vault = admin.deploy(Erc20Vault, controller)
    vault.initialize(pool, 0, 1e18, 0)
    vault.preparePerformanceFee(scale("0.05"))
    chain.sleep(ADMIN_DELAY)
    vault.executePerformanceFee()
    mockStrategy.setVault(vault, {"from": admin})
    mockLockingStrategy.setVault(vault, {"from": admin})
    pool.setVault(vault, {"from": admin})
    return vault


def execute_new_strategy(mockVault, mockStrategy, admin):
    assert mockVault.getStrategy() == ZERO_ADDRESS
    mockVault.prepareNewStrategy(mockStrategy, {"from": admin})
    chain.sleep(STRATEGY_DELAY)
    mockVault.executeNewStrategy()
    assert mockVault.getStrategy() == mockStrategy


def test_execute_new_strategy(mockVault, mockStrategy, admin):
    execute_new_strategy(mockVault, mockStrategy, admin)


@pytest.mark.usefixtures("inflation_kickoff")
def test_execute_new_strategy_with_inflation(mockVault, mockStrategy, admin):
    execute_new_strategy(mockVault, mockStrategy, admin)


def test_execute_new_strategy_zero_address(mockVault, admin):
    assert mockVault.getStrategy() == ZERO_ADDRESS
    mockVault.prepareNewStrategy(ZERO_ADDRESS, {"from": admin})
    chain.sleep(STRATEGY_DELAY)
    mockVault.executeNewStrategy()
    assert mockVault.getStrategy() == ZERO_ADDRESS


def _set_strategy(vault, strategy, admin):
    vault.prepareNewStrategy(strategy, {"from": admin})
    chain.sleep(STRATEGY_DELAY)
    tx = vault.executeNewStrategy()
    assert vault.getStrategy() == strategy
    return tx


def test_execute_new_strategy_without_locked_funds(
    mockVault, mockLockingStrategy, admin, alice, decimals, coin
):
    assert mockVault.getStrategy() == ZERO_ADDRESS
    _set_strategy(mockVault, mockLockingStrategy, admin)

    strategy_balance = scale(10, decimals)
    assert _balance(mockLockingStrategy, coin) == 0
    _pay_strategy(alice, mockLockingStrategy, strategy_balance, coin)

    balance_before = _balance(mockVault, coin)
    _set_strategy(mockVault, ZERO_ADDRESS, admin)
    balance_after = _balance(mockVault, coin)
    assert mockVault.getStrategistFee() == 0.1e18
    # 5% fees of which 10% goes back to the pool through the strategist
    assert balance_after - balance_before == strategy_balance * 955 / 1000
    assert _balance(mockLockingStrategy, coin) == 0
    assert len(mockVault.getStrategiesWaitingForRemoval()) == 0


def test_execute_new_strategy_with_locked_funds(
    mockVault, mockLockingStrategy, admin, alice, decimals, coin
):
    assert mockVault.getStrategy() == ZERO_ADDRESS
    _set_strategy(mockVault, mockLockingStrategy, admin)

    strategy_balance = scale(10, decimals)
    locked = scale(2, decimals)

    _pay_strategy(alice, mockLockingStrategy, strategy_balance, coin)
    mockLockingStrategy.setAmountLocked(locked, {"from": admin})

    withdrawable = strategy_balance - locked

    balance_before = _balance(mockVault, coin)
    _set_strategy(mockVault, ZERO_ADDRESS, admin)
    balance_after = _balance(mockVault, coin)
    # 5% fees of which 10% goes back to the pool through the strategist
    fees = strategy_balance * 45 / 1000
    assert balance_after - balance_before == withdrawable - fees
    assert _balance(mockLockingStrategy, coin) == locked
    assert mockVault.getStrategiesWaitingForRemoval() == [mockLockingStrategy]

    mockLockingStrategy.setAmountLocked(scale("0.5", decimals), {"from": admin})

    balance_before = _balance(mockVault, coin)
    mockVault.withdrawFromStrategyWaitingForRemoval(
        mockLockingStrategy, {"from": admin}
    )
    balance_after = _balance(mockVault, coin)
    assert balance_after - balance_before == scale(
        "1.5", decimals
    )  # no profit -> no fee
    assert mockVault.getStrategiesWaitingForRemoval() == [mockLockingStrategy]

    mockLockingStrategy.setAmountLocked(0, {"from": admin})
    balance_before = _balance(mockVault, coin)
    mockVault.withdrawFromStrategyWaitingForRemoval(
        mockLockingStrategy, {"from": admin}
    )
    balance_after = _balance(mockVault, coin)
    assert balance_after - balance_before == scale(
        "0.5", decimals
    )  # no profit -> no fee
    assert len(mockVault.getStrategiesWaitingForRemoval()) == 0


def test_execute_new_strategy_with_locked_funds_and_profit(
    mockVault, mockLockingStrategy, admin, alice, decimals, coin, vaultReserve
):
    assert mockVault.getStrategy() == ZERO_ADDRESS
    _set_strategy(mockVault, mockLockingStrategy, admin)
    assert coin.allowance(mockVault, mockVault.reserve()) == 2**256 - 1

    _pay_strategy(alice, mockLockingStrategy, scale(10, decimals), coin)
    mockLockingStrategy.setAmountLocked(scale(2, decimals), {"from": admin})

    assert coin.allowance(mockVault, mockVault.reserve()) == 2**256 - 1
    _set_strategy(mockVault, ZERO_ADDRESS, admin)
    assert vaultReserve.getBalance(mockVault, coin) == scale(10, decimals) * 5 / 10_000
    assert coin.allowance(mockVault, mockVault.reserve()) == 2**256 - 1

    assert _balance(mockLockingStrategy, coin) == scale(2, decimals)

    assert mockVault.waitingForRemovalAllocated() == scale(2, decimals)

    # more profits
    _pay_strategy(alice, mockLockingStrategy, scale("0.5", decimals), coin)

    mockLockingStrategy.setAmountLocked(scale("0.8", decimals), {"from": admin})

    balance_before = _balance(mockVault, coin)
    mockVault.withdrawFromStrategyWaitingForRemoval(
        mockLockingStrategy, {"from": admin}
    )
    balance_after = _balance(mockVault, coin)
    expected = scale("2.5", decimals) - scale("0.8", decimals)  # balance - locked
    assert balance_after - balance_before == expected  # profit not withdrawn yet
    assert mockVault.getStrategiesWaitingForRemoval() == [mockLockingStrategy]

    assert mockVault.getAllocatedToStrategyWaitingForRemoval(
        mockLockingStrategy
    ) == scale("0.3", decimals)

    assert mockVault.waitingForRemovalAllocated() == scale("0.3", decimals)

    mockLockingStrategy.setAmountLocked(0, {"from": admin})
    balance_before = _balance(mockVault, coin)
    assert coin.allowance(mockVault, mockVault.reserve()) == 2**256 - 1
    tx = mockVault.withdrawFromStrategyWaitingForRemoval(
        mockLockingStrategy, {"from": admin}
    )
    balance_after = _balance(mockVault, coin)
    assert tx.events["Harvest"]["netProfit"] == scale("0.5", decimals)
    fees = scale("0.5", decimals) * 45 / 1000  # fees are only charged on profits
    expected = scale("0.8", decimals) - fees
    assert balance_after - balance_before == expected
    assert mockVault.waitingForRemovalAllocated() == 0
    assert len(mockVault.getStrategiesWaitingForRemoval()) == 0


def _balance(strategy, coin):
    if coin == ZERO_ADDRESS:
        return strategy.wei_balance()
    else:
        return coin.balanceOf(strategy)


def _pay_strategy(account, strategy, amount, coin):
    if coin == ZERO_ADDRESS:
        account.transfer(strategy, amount)
    else:
        coin.mintFor(strategy, amount, {"from": account})
