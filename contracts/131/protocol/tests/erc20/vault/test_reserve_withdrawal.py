import pytest
from brownie.test.managers.runner import RevertContextManager as reverts

from support.constants import AddressProviderKeys

MOCK_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"

MINT_AMOUNT = 1_000_000

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


# Reverts
def test_reverts_with_zero(vault):
    with reverts("invalid amount"):
        vault.withdrawFromReserve(0)


def test_reverts_with_excess_balance(vault, pool, admin):
    pool.pause({"from": admin})
    with reverts("insufficient balance"):
        vault.withdrawFromReserve(100**18)


def test_reverts_with_unpaused_pool(vault):
    with reverts("Pool must be paused to withdraw from reserve"):
        vault.withdrawFromReserve(100**18)


# Functions


def test_withdraw_from_reserve(
    vault, address_provider, mockStrategy, coin, decimals, admin, pool
):
    profit = 10**decimals
    coin.mint_for_testing(mockStrategy, profit)
    reserve = address_provider.getAddress(AddressProviderKeys.VAULT_RESERVE.value)
    vault.harvest({"from": admin})
    reserveBalance = coin.balanceOf(reserve)
    assert reserveBalance > 0
    vaultBalance = vault.getTotalUnderlying()
    pool.pause({"from": admin})
    vault.withdrawFromReserve(reserveBalance, {"from": admin})
    assert coin.balanceOf(reserve) == 0
    assert vault.getTotalUnderlying() == vaultBalance + reserveBalance


def test_reserve_withdrawal_excess_debt(vault, admin, vaultReserve, decimals, coin, mockStrategy):
    DEPOSIT_AMOUNT = MINT_AMOUNT * 10 ** decimals
    coin.mint_for_testing(vault, DEPOSIT_AMOUNT)
    coin.mint_for_testing(vaultReserve, DEPOSIT_AMOUNT)
    vault.depositToReserve(coin, DEPOSIT_AMOUNT)
    assert coin.balanceOf(vaultReserve) == 2 * DEPOSIT_AMOUNT
    assert vaultReserve.getBalance(vault, coin) == DEPOSIT_AMOUNT

    strategyFunds = coin.balanceOf(mockStrategy)
    # set strategy debt
    mockStrategy.drainFunds(admin)

    vault.harvest({"from": admin})
    assert vaultReserve.getBalance(vault, coin) == DEPOSIT_AMOUNT - strategyFunds
