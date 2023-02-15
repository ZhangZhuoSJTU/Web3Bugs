import pytest
from brownie import ZERO_ADDRESS

from support.constants import AddressProviderKeys

MOCK_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"

pytestmark = pytest.mark.usefixtures("setUpVault", "addInitialLiquidity")

# vault params
TARGET_ALLOC = 0.9
DEVIATION_BOUND = 0.05


@pytest.fixture
def setUpVault(admin, vault, mockStrategy):
    vault.setStrategy(mockStrategy, {"from": admin})
    vault.activateStrategy({"from": admin})
    mockStrategy.setVault(vault, {"from": admin})
    vault.setTargetAllocation(10**18 * TARGET_ALLOC)
    vault.setBound(10**18 * DEVIATION_BOUND)


def test_harvest_no_profit_no_loss(vault):
    tx = vault.harvest()
    assert len(tx.events) == 0


def test_harvest_profit(
    vault, address_provider, mockStrategy, coin, decimals, initialAmount, admin
):
    assert vault.currentAllocated() == TARGET_ALLOC * initialAmount
    profit = 10**decimals

    # mock strategy profit
    coin.mint_for_testing(mockStrategy, profit)
    assert mockStrategy.strategist() != ZERO_ADDRESS

    performance_fee = vault.getPerformanceFee()
    reserve_fee = vault.getReserveFee()
    reserve = address_provider.getAddress(AddressProviderKeys.VAULT_RESERVE.value)

    tx = vault.harvest({"from": admin})
    assert tx.events["Harvest"]["netProfit"] == profit - (
        profit * performance_fee / 1e18
    )
    assert tx.events["Harvest"]["loss"] == 0
    assert pytest.approx(coin.balanceOf(reserve)) == pytest.approx(
        profit * performance_fee / 1e18 * reserve_fee / 1e18
    )


def test_harvest_loss_emergency_stop(vault, mockStrategy, coin, initialAmount, admin):
    assert vault.strategyActive
    assert vault.currentAllocated() == TARGET_ALLOC * initialAmount
    loss = 0.5 * TARGET_ALLOC * initialAmount

    # mock strategy loss of 50%
    mockStrategy.transfer(coin, MOCK_ADDRESS, loss, {"from": admin})

    tx = vault.harvest({"from": admin})
    assert tx.events["Harvest"]["netProfit"] == 0
    assert tx.events["Harvest"]["loss"] == loss
    assert vault.strategyActive() == False
