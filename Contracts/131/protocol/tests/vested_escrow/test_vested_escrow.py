import brownie
import pytest
from brownie import chain, web3
from brownie.network.rpc import ganache
from brownie.test import given, strategy
import math
import time

VEST_DURATION = 365 * 86400
TOTAL_AMOUNT = 1_000_000 * 10 ** 18
DELAY = 86400 * 10
START_TIME = int(time.time()) + DELAY

ALICE_AMOUNT = TOTAL_AMOUNT / 2
BOB_AMOUNT = TOTAL_AMOUNT / 4
CHARLIE_AMOUNT = TOTAL_AMOUNT / 4


@pytest.fixture(scope="module")
def vestedEscrow(VestedEscrow, admin, mockToken, alice):
    return admin.deploy(
        VestedEscrow, mockToken, START_TIME, START_TIME + VEST_DURATION, alice
    )


@pytest.fixture
def fundVestedEscrow(mockToken, vestedEscrow, alice, bob, charlie, admin):
    mockToken.mint_for_testing(vestedEscrow, TOTAL_AMOUNT)
    vestedEscrow.initializeUnallocatedSupply({"from": admin})
    vestedEscrow.fund(
        [(alice, ALICE_AMOUNT), (bob, BOB_AMOUNT), (charlie, CHARLIE_AMOUNT)]
    )


def test_fund(fundVestedEscrow, vestedEscrow, alice, admin, bob, charlie):
    assert vestedEscrow.lockedSupply() == TOTAL_AMOUNT
    assert vestedEscrow.balanceOf(alice) == 0
    assert vestedEscrow.balanceOf(bob) == 0
    assert vestedEscrow.balanceOf(charlie) == 0
    assert vestedEscrow.lockedOf(alice) == 500_000 * 10 ** 18
    assert vestedEscrow.lockedOf(bob) == 250_000 * 10 ** 18
    assert vestedEscrow.lockedOf(charlie) == 250_000 * 10 ** 18
    assert vestedEscrow.vestedSupply() == 0
    assert vestedEscrow.initialLockedSupply() == TOTAL_AMOUNT
    assert vestedEscrow.unallocatedSupply() == 0


def test_fund_revert(vestedEscrow, mockToken, alice, bob, charlie):
    mockToken.mint_for_testing(vestedEscrow, TOTAL_AMOUNT)
    with brownie.reverts():
        vestedEscrow.fund(
            [(alice, ALICE_AMOUNT), (bob, BOB_AMOUNT), (charlie, CHARLIE_AMOUNT)]
        )


def test_fund_revert_insufficient_funds(
    vestedEscrow, mockToken, admin, alice, bob, charlie
):
    mockToken.mint_for_testing(vestedEscrow, TOTAL_AMOUNT)
    vestedEscrow.initializeUnallocatedSupply({"from": admin})
    with brownie.reverts():
        vestedEscrow.fund(
            [(alice, ALICE_AMOUNT), (bob, BOB_AMOUNT), (charlie, 300_000 * 10 ** 18)]
        )


def test_locked_of(fundVestedEscrow, vestedEscrow, alice, bob, charlie):
    assert vestedEscrow.lockedSupply() == TOTAL_AMOUNT
    chain.mine(1, int(START_TIME + VEST_DURATION / 2))
    assert vestedEscrow.lockedOf(alice) == 250_000 * 10 ** 18
    assert vestedEscrow.lockedOf(bob) == 125_000 * 10 ** 18
    assert vestedEscrow.lockedOf(charlie) == 125_000 * 10 ** 18


def test_vested_of(fundVestedEscrow, vestedEscrow, alice, bob, charlie):
    chain.mine(1, int(START_TIME + VEST_DURATION / 4))
    assert vestedEscrow.lockedOf(alice) == 375_000 * 10 ** 18
    assert vestedEscrow.vestedOf(alice) == 125_000 * 10 ** 18

    chain.mine(1, int(START_TIME + VEST_DURATION / 2))
    assert vestedEscrow.lockedOf(alice) == 250_000 * 10 ** 18
    assert vestedEscrow.vestedOf(alice) == 250_000 * 10 ** 18
    assert vestedEscrow.vestedOf(bob) == 125_000 * 10 ** 18
    assert vestedEscrow.vestedOf(charlie) == 125_000 * 10 ** 18


def test_balance_of(fundVestedEscrow, vestedEscrow, alice, bob, charlie):
    assert vestedEscrow.lockedSupply() == TOTAL_AMOUNT

    chain.mine(1, int(START_TIME + VEST_DURATION / 4))
    assert vestedEscrow.lockedOf(alice) == 375_000 * 10 ** 18
    assert vestedEscrow.balanceOf(alice) == 125_000 * 10 ** 18

    chain.mine(1, int(START_TIME + VEST_DURATION / 2))
    assert vestedEscrow.lockedOf(alice) / 1e18 == pytest.approx(250_000, 0.1)
    assert vestedEscrow.balanceOf(alice) / 1e18 == pytest.approx(250_000, 0.1)
    assert vestedEscrow.balanceOf(bob) / 1e18 == pytest.approx(125_000, 0.1)
    assert vestedEscrow.balanceOf(charlie) / 1e18 == pytest.approx(125_000, 0.1)

    chain.mine(1, int(START_TIME + VEST_DURATION / 4 * 3))
    assert vestedEscrow.lockedOf(alice) == 125_000 * 10 ** 18
    assert vestedEscrow.balanceOf(alice) == 375_000 * 10 ** 18

    chain.mine(1, int(START_TIME + VEST_DURATION))
    assert vestedEscrow.lockedOf(alice) == 0
    assert vestedEscrow.balanceOf(alice) == 500_000 * 10 ** 18
    assert vestedEscrow.vestedOf(alice) == 500_000 * 10 ** 18

    assert vestedEscrow.lockedOf(bob) == 0
    assert vestedEscrow.balanceOf(bob) / 1e18 == pytest.approx(250_000, 0.1)
    assert vestedEscrow.vestedOf(bob) / 1e18 == pytest.approx(250_000, 0.1)

    assert vestedEscrow.lockedOf(charlie) == 0
    assert vestedEscrow.balanceOf(charlie) == 250_000 * 10 ** 18
    assert vestedEscrow.vestedOf(charlie) == 250_000 * 10 ** 18


def test_claim(mockToken, fundVestedEscrow, vestedEscrow, alice):
    assert vestedEscrow.lockedSupply() == TOTAL_AMOUNT
    chain.sleep(DELAY + int(VEST_DURATION / 2))
    chain.mine()
    assert vestedEscrow.balanceOf(alice) / 1e18 == pytest.approx(250_000, 0.1)
    assert vestedEscrow.lockedOf(alice) / 1e18 == pytest.approx(250_000, 0.1)
    tx = vestedEscrow.claim({"from": alice})
    assert tx.events["Claim"]["user"] == alice
    assert tx.events["Claim"]["amount"] / 1e18 == pytest.approx(250_000, 0.1)
    assert vestedEscrow.balanceOf(alice) == 0
    alice_holdings = vestedEscrow.holdingContract(alice)
    assert mockToken.balanceOf(alice_holdings) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 - 250_000, 0.1
    )
    assert mockToken.balanceOf(alice) / 1e18 == pytest.approx(250_000, 0.1)


def test_vest_and_claim(mockToken, fundVestedEscrow, vestedEscrow, alice):
    chain.sleep(DELAY + int(VEST_DURATION / 4))
    chain.mine()
    assert vestedEscrow.lockedOf(alice) / 1e18 == pytest.approx(375_000, 0.1)
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(125_000, 0.1)
    vestedEscrow.claim({"from": alice})
    assert mockToken.balanceOf(alice) / 1e18 == pytest.approx(125_000, 0.1)
    alice_holdings = vestedEscrow.holdingContract(alice)
    assert mockToken.balanceOf(alice_holdings) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 - 125_000, 0.1
    )

    chain.mine(1, int(START_TIME + VEST_DURATION / 2))
    assert vestedEscrow.lockedOf(alice) / 1e18 == pytest.approx(250_000, 0.1)
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(250_000, 0.1)
    assert vestedEscrow.balanceOf(alice) / 1e18 == pytest.approx(125_000, 0.1)


@given(duration=strategy("uint", min_value=1, max_value=1000))
def test_vested_supply(mockToken, alice, bob, charlie, admin, duration, vestedEscrow):
    mockToken.mint_for_testing(vestedEscrow, TOTAL_AMOUNT)
    vestedEscrow.initializeUnallocatedSupply({"from": admin})
    vestedEscrow.fund(
        [(alice, ALICE_AMOUNT), (bob, BOB_AMOUNT), (charlie, CHARLIE_AMOUNT)]
    )

    chain.mine(1, int(START_TIME + VEST_DURATION / duration))
    assert vestedEscrow.vestedSupply() / 1e18 == pytest.approx(
        TOTAL_AMOUNT / 1e18 / duration, 1
    )
