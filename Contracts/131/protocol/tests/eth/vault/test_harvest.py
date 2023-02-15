import pytest
from brownie import ZERO_ADDRESS

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
    vault, pool, lpToken, mockStrategy, initialAmount, treasury, admin
):
    assert vault.currentAllocated() == TARGET_ALLOC * initialAmount
    scale = 10**18
    profit = scale

    # mock strategy profit
    admin.transfer(mockStrategy, profit)

    prev_treasury_balance = treasury.balance()
    performanceFee = vault.getPerformanceFee()
    strategistFee = vault.getStrategistFee()
    reserveFee = vault.getReserveFee()

    assert lpToken.balanceOf(MOCK_ADDRESS) == 0
    tx = vault.harvest({"from": admin})
    profitShare = profit * performanceFee / 1e18

    assert tx.events["Harvest"]["netProfit"] == profit - profitShare
    assert tx.events["Harvest"]["loss"] == 0
    treasury_fees = treasury.balance() - prev_treasury_balance
    assert treasury_fees == profitShare * (scale - strategistFee - reserveFee) // scale
    strategistBalance = lpToken.balanceOf(MOCK_ADDRESS)
    actual_strategist_profit = pool.exchangeRate() * strategistBalance // scale
    expected_strategist_profit = strategistFee * profitShare // scale
    assert actual_strategist_profit == expected_strategist_profit


def test_harvest_loss_emergency_stop(vault, mockStrategy, coin, initialAmount, admin):
    assert vault.strategyActive
    assert vault.currentAllocated() == TARGET_ALLOC * initialAmount
    loss = 0.5 * TARGET_ALLOC * initialAmount

    # mock strategy loss of 50%
    mockStrategy.burnETH(loss)

    tx = vault.harvest({"from": admin})
    assert tx.events["Harvest"]["netProfit"] == 0
    assert tx.events["Harvest"]["loss"] == loss
    assert vault.strategyActive() == False
