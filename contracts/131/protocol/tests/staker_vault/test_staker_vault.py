import brownie
import pytest


pytestmark = pytest.mark.usefixtures("add_pool_to_controller")


@pytest.fixture
def add_pool_to_controller(admin, address_provider, pool):
    address_provider.addPool(pool, {"from": admin})


def test_transfer(stakerVault, lpToken, admin, alice, bob):
    lpToken.mint_for_testing(alice, 1e18, {"from": admin})
    lpToken.approve(stakerVault, 1e18, {"from": alice})
    stakerVault.stake(1e18, {"from": alice})
    assert lpToken.balanceOf(stakerVault) == 1e18
    assert lpToken.balanceOf(alice) == 0
    assert lpToken.balanceOf(bob) == 0
    assert stakerVault.balanceOf(alice) == 1e18
    assert stakerVault.balanceOf(bob) == 0

    stakerVault.transfer(bob, 1e18, {"from": alice})
    assert lpToken.balanceOf(stakerVault) == 1e18
    assert lpToken.balanceOf(alice) == 0
    assert lpToken.balanceOf(bob) == 0
    assert stakerVault.balanceOf(alice) == 0
    assert stakerVault.balanceOf(bob) == 1e18

    stakerVault.transfer(alice, 1e18, {"from": bob})
    assert stakerVault.balanceOf(alice) == 1e18
    assert stakerVault.balanceOf(bob) == 0


@pytest.mark.usefixtures("add_pool_to_controller")
def test_transfer_from(stakerVault, lpToken, admin, alice, bob, charlie):
    lpToken.mint_for_testing(alice, 1e18, {"from": admin})
    lpToken.approve(stakerVault, 1e18, {"from": alice})
    stakerVault.stake(1e18, {"from": alice})
    stakerVault.approve(bob, 1e18, {"from": alice})
    stakerVault.transferFrom(alice, bob, 1e18, {"from": bob})
    assert lpToken.balanceOf(stakerVault) == 1e18
    assert lpToken.balanceOf(alice) == 0
    assert lpToken.balanceOf(bob) == 0
    assert stakerVault.balanceOf(alice) == 0
    assert stakerVault.balanceOf(bob) == 1e18

    stakerVault.approve(charlie, 1e18, {"from": bob})
    stakerVault.transferFrom(bob, alice, 1e18, {"from": charlie})
    assert lpToken.balanceOf(stakerVault) == 1e18
    assert lpToken.balanceOf(alice) == 0
    assert lpToken.balanceOf(bob) == 0
    assert lpToken.balanceOf(charlie) == 0
    assert stakerVault.balanceOf(alice) == 1e18
    assert stakerVault.balanceOf(bob) == 0
    assert stakerVault.balanceOf(charlie) == 0


@pytest.mark.usefixtures("add_pool_to_controller")
def test_approve(stakerVault, lpToken, admin, alice, bob):
    lpToken.mint_for_testing(alice, 1e18, {"from": admin})
    lpToken.approve(stakerVault, 1e18, {"from": alice})
    stakerVault.stake(1e18, {"from": alice})
    stakerVault.approve(bob, 0.5 * 1e18, {"from": alice})
    assert stakerVault.allowance(alice, bob) == 0.5 * 1e18
    assert stakerVault.balanceOf(bob) == 0
    assert stakerVault.balanceOf(alice) == 1e18
    stakerVault.transferFrom(alice, bob, 0.5 * 1e18, {"from": bob})
    assert stakerVault.balanceOf(alice) == 0.5 * 1e18
    assert stakerVault.balanceOf(bob) == 0.5 * 1e18


@pytest.mark.usefixtures("add_pool_to_controller")
def test_stake(stakerVault, lpToken, admin, alice):
    lpToken.mint_for_testing(alice, 1e18, {"from": admin})
    lpToken.approve(stakerVault, 1e18, {"from": alice})
    stakerVault.stake(1e18, {"from": alice})
    assert lpToken.balanceOf(stakerVault) == 1e18
    assert lpToken.balanceOf(alice) == 0


def test_stake_fail(stakerVault, pool, lpToken, alice):
    assert lpToken.balanceOf(stakerVault) == 0
    with brownie.reverts("insufficient balance"):
        stakerVault.stake(1e18, {"from": alice})
    assert lpToken.balanceOf(stakerVault) == 0
    assert stakerVault.balanceOf(alice) == 0


def test_stake_for(stakerVault, admin, lpToken, alice, bob):
    lpToken.mint_for_testing(alice, 1e18, {"from": admin})
    lpToken.approve(stakerVault, 1e18, {"from": alice})
    stakerVault.stakeFor(bob, 1e18, {"from": alice})
    assert lpToken.balanceOf(stakerVault) == 1e18
    assert lpToken.balanceOf(alice) == 0
    assert stakerVault.balanceOf(alice) == 0
    assert stakerVault.balanceOf(bob) == 1e18


def test_stake_for_fail(stakerVault, pool, lpToken, alice, bob):
    # insufficient funds
    with brownie.reverts("insufficient balance"):
        stakerVault.stakeFor(bob, 1e18, {"from": alice})

    # insufficient allowance for vault
    lpToken.mint_for_testing(alice, 1e18, {"from": alice})
    with brownie.reverts("ERC20: insufficient allowance"):
        stakerVault.stakeFor(bob, 1e18, {"from": alice})


def test_unstake(stakerVault, admin, lpToken, alice):
    lpToken.mint_for_testing(alice, 1e18, {"from": admin})
    lpToken.approve(stakerVault, 1e18, {"from": alice})
    stakerVault.stake(1e18, {"from": alice})
    stakerVault.unstake(1e18, {"from": alice})
    assert lpToken.balanceOf(stakerVault) == 0
    assert lpToken.balanceOf(alice) == 1e18


def test_unstake_fail(stakerVault, admin, lpToken, alice, bob):
    lpToken.mint_for_testing(alice, 1e18, {"from": admin})
    lpToken.approve(stakerVault, 1e18, {"from": alice})
    stakerVault.stake(1e18, {"from": alice})

    with brownie.reverts("unauthorized access"):
        stakerVault.unstakeFor(alice, bob, 1e18, {"from": bob})


def test_unstake_for(stakerVault, pool, lpToken, alice, bob, address_provider, admin):
    address_provider.addPool(pool, {"from": admin})
    lpToken.mint_for_testing(alice, 1e18, {"from": alice})
    lpToken.approve(stakerVault, 1e18, {"from": alice})
    stakerVault.stake(1e18, {"from": alice})
    stakerVault.approve(bob, 1e18, {"from": alice})
    stakerVault.unstakeFor(alice, bob, 1e18, {"from": bob})
    assert lpToken.balanceOf(stakerVault) == 0
    assert lpToken.balanceOf(bob) == 1e18

    lpToken.mint_for_testing(alice, 1e18, {"from": alice})
    lpToken.approve(stakerVault, 1e18, {"from": alice})
    stakerVault.stake(1e18, {"from": alice})
    stakerVault.unstake(1e18, {"from": alice})
    assert lpToken.balanceOf(stakerVault) == 0
    assert lpToken.balanceOf(alice) == 1e18
    assert stakerVault.balanceOf(alice) == 0
    assert stakerVault.balanceOf(bob) == 0
