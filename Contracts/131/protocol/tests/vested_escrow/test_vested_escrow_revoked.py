import time
import brownie
import pytest
from brownie import chain
from brownie.test import given, strategy
from support.utils import scale


VEST_DURATION = 365 * 86400
TOTAL_AMOUNT = scale(1_000_000)
DELAY = 86400 * 10

ALICE_AMOUNT = TOTAL_AMOUNT / 2
BOB_AMOUNT = TOTAL_AMOUNT / 4
CHARLIE_AMOUNT = TOTAL_AMOUNT / 4


@pytest.fixture(scope="module")
def startTime():
    return int(time.time()) + DELAY

@pytest.fixture(scope="module")
def vestedEscrow(VestedEscrowRevocable, admin, mockToken, alice, treasury, startTime):
    return admin.deploy(
        VestedEscrowRevocable,
        mockToken,
        startTime,
        startTime + VEST_DURATION,
        alice,
        treasury,
    )


@pytest.fixture(scope="module")
def fundVestedEscrow(mockToken, vestedEscrow, alice, bob, charlie, admin):
    mockToken.mint_for_testing(vestedEscrow, TOTAL_AMOUNT)
    vestedEscrow.initializeUnallocatedSupply({"from": admin})
    assert vestedEscrow.balanceOf(alice) == 0
    vestedEscrow.fund(
        [(alice, ALICE_AMOUNT), (bob, BOB_AMOUNT), (charlie, CHARLIE_AMOUNT)]
    )


def test_locked_of(fundVestedEscrow, vestedEscrow, alice, bob, charlie, admin, startTime):
    assert vestedEscrow.lockedSupply() == TOTAL_AMOUNT
    chain.mine(1, int(startTime + VEST_DURATION / 2))
    assert pytest.approx(vestedEscrow.lockedOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.lockedOf(bob)) == scale(125_000)
    assert pytest.approx(vestedEscrow.lockedOf(charlie)) == scale(125_000)


def test_vested_of(fundVestedEscrow, vestedEscrow, alice, bob, charlie, admin, startTime):
    assert pytest.approx(vestedEscrow.lockedSupply()) == TOTAL_AMOUNT

    chain.mine(1, int(startTime + VEST_DURATION / 4))
    assert pytest.approx(vestedEscrow.lockedOf(alice)) == scale(375_000)
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(125_000)

    chain.mine(1, int(startTime + VEST_DURATION / 2))
    assert pytest.approx(vestedEscrow.lockedOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.vestedOf(bob)) == scale(125_000)
    assert pytest.approx(vestedEscrow.vestedOf(charlie)) == scale(125_000)


def test_balance_of(fundVestedEscrow, vestedEscrow, alice, bob, charlie, startTime):
    chain.mine(1, int(startTime + VEST_DURATION / 4))
    assert pytest.approx(vestedEscrow.lockedOf(alice)) == scale(375_000)
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(125_000)

    chain.mine(1, int(startTime + VEST_DURATION / 2))
    assert pytest.approx(vestedEscrow.lockedOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.balanceOf(bob)) == scale(125_000)
    assert pytest.approx(vestedEscrow.balanceOf(charlie)) == scale(125_000)

    chain.mine(1, int(startTime + VEST_DURATION / 4 * 3))
    assert pytest.approx(vestedEscrow.lockedOf(alice)) == scale(125_000)
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(375_000)

    chain.mine(1, int(startTime + VEST_DURATION))
    assert vestedEscrow.lockedOf(alice) == 0
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(500_000)
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(500_000)

    assert vestedEscrow.lockedOf(bob) == 0
    assert pytest.approx(vestedEscrow.balanceOf(bob)) == scale(250_000)
    assert pytest.approx(vestedEscrow.vestedOf(bob)) == scale(250_000)

    assert vestedEscrow.lockedOf(charlie) == 0
    assert pytest.approx(vestedEscrow.balanceOf(charlie)) == scale(250_000)
    assert pytest.approx(vestedEscrow.vestedOf(charlie)) == scale(250_000)


def test_claim(fundVestedEscrow, mockToken, vestedEscrow, alice, startTime):
    chain.mine()
    chain.sleep(startTime - chain.time() + int(VEST_DURATION / 2))
    chain.mine()
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.lockedOf(alice)) == scale(250_000)
    vestedEscrow.claim({"from": alice})
    assert vestedEscrow.balanceOf(alice) == 0
    alice_holdings = vestedEscrow.holdingContract(alice)
    assert pytest.approx(mockToken.balanceOf(alice_holdings)) == scale(250_000)
    assert pytest.approx(mockToken.balanceOf(alice)) == scale(250_000)


def test_vest_and_claim(mockToken, fundVestedEscrow, vestedEscrow, alice, startTime):
    chain.mine()
    chain.sleep(startTime - chain.time() + int(VEST_DURATION / 4))
    chain.mine()
    assert pytest.approx(vestedEscrow.lockedOf(alice)) == scale(375_000)
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(125_000)
    vestedEscrow.claim({"from": alice})
    assert pytest.approx(mockToken.balanceOf(alice)) == scale(125_000)
    alice_holdings = vestedEscrow.holdingContract(alice)
    assert pytest.approx(mockToken.balanceOf(alice_holdings)) == scale(375_000)

    chain.mine()
    chain.sleep(int(VEST_DURATION / 2) - (chain.time() - startTime))
    chain.mine()
    assert pytest.approx(vestedEscrow.lockedOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(125_000)


@given(duration=strategy("uint", min_value=1, max_value=1000))
def test_vested_supply(fundVestedEscrow, duration, vestedEscrow, startTime):
    chain.mine()
    chain.sleep(startTime - chain.time() + int(VEST_DURATION / duration))
    chain.mine()
    assert pytest.approx(vestedEscrow.vestedSupply(), abs=scale(1)) == TOTAL_AMOUNT / duration


def test_revoke(fundVestedEscrow, vestedEscrow, alice, admin, startTime):
    chain.mine()
    chain.sleep(startTime - chain.time() + int(VEST_DURATION / 2))
    chain.mine()
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)

    vestedEscrow.revoke(alice, {"from": admin})
    chain.mine()
    chain.sleep(int((VEST_DURATION * 3) / 4) - (chain.time() - startTime))
    chain.mine()
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)

    chain.sleep(DELAY + int(VEST_DURATION / 4))
    chain.mine()
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)


def test_revoke_revert(vestedEscrow, alice, bob):
    with brownie.reverts():
        vestedEscrow.revoke(bob, {"from": alice})


def test_revoke_and_claim(
    mockToken, fundVestedEscrow, vestedEscrow, alice, admin, treasury, startTime
):
    chain.mine()
    chain.sleep(startTime - chain.time() + int(VEST_DURATION / 2))
    chain.mine()
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)

    vestedEscrow.revoke(alice, {"from": admin})
    chain.mine()
    chain.sleep(int((VEST_DURATION * 3) / 4) - (chain.time() - startTime))
    chain.mine()
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)
    vestedEscrow.claim({"from": alice})
    assert vestedEscrow.balanceOf(alice) == 0
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)

    assert pytest.approx(vestedEscrow.totalClaimed(treasury)) == vestedEscrow.vestedOf(alice)
    vestedEscrow.claim(treasury, {"from": treasury})
    assert pytest.approx(mockToken.balanceOf(treasury)) == scale(125_000)

    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    assert pytest.approx(vestedEscrow.balanceOf(alice)) == 0
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)

    vestedEscrow.claim(treasury, {"from": treasury})
    assert pytest.approx(mockToken.balanceOf(treasury)) == scale(250_000)

    assert vestedEscrow.lockedSupply() == 0


def test_locked_of_revoked(fundVestedEscrow, vestedEscrow, alice, admin, startTime):
    chain.mine()
    chain.sleep(startTime - chain.time() + int(VEST_DURATION / 2))
    chain.mine()
    assert pytest.approx(int(vestedEscrow.balanceOf(alice))) == scale(250_000)
    assert pytest.approx(int(vestedEscrow.vestedOf(alice))) == scale(250_000)

    assert vestedEscrow.lockedOf(alice) != 0
    vestedEscrow.revoke(alice, {"from": admin})
    assert vestedEscrow.lockedOf(alice) == 0


def test_revoke_balance_of(
    mockToken, fundVestedEscrow, vestedEscrow, alice, admin, treasury, startTime
):
    chain.mine()
    chain.sleep(startTime - chain.time() + int(VEST_DURATION / 2))
    chain.mine()
    alice_holdings = vestedEscrow.holdingContract(alice)

    assert pytest.approx(mockToken.balanceOf(alice_holdings)) == ALICE_AMOUNT

    vestedEscrow.revoke(alice, {"from": admin})

    assert pytest.approx(mockToken.balanceOf(alice_holdings)) == vestedEscrow.vestedOf(alice)

    chain.mine()
    chain.sleep(int((VEST_DURATION * 3) / 4) - (chain.time() - startTime))
    chain.mine()

    assert pytest.approx(mockToken.balanceOf(alice_holdings)) == vestedEscrow.vestedOf(alice)

    assert pytest.approx(vestedEscrow.balanceOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.balanceOf(treasury)) == scale(125_000)

    vestedEscrow.claim({"from": alice})

    assert mockToken.balanceOf(alice_holdings) == 0
    assert vestedEscrow.balanceOf(alice) == 0
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)

    assert vestedEscrow.totalClaimed(treasury) == vestedEscrow.vestedOf(alice)
    vestedEscrow.claim(treasury, {"from": treasury})
    assert pytest.approx(mockToken.balanceOf(treasury)) == scale(125_000)
    assert vestedEscrow.balanceOf(alice) == 0

    chain.sleep(int(VEST_DURATION))
    chain.mine()
    assert vestedEscrow.balanceOf(alice) == 0
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(250_000)
    assert pytest.approx(vestedEscrow.balanceOf(treasury)) == scale(125_000)
    assert pytest.approx(vestedEscrow.vestedOf(treasury)) == scale(250_000)
    vestedEscrow.claim(alice, {"from": alice})
    assert vestedEscrow.balanceOf(alice) == 0


def test_treasury_vested_of(fundVestedEscrow, vestedEscrow, alice, admin, treasury, startTime):
    chain.mine()
    chain.sleep(startTime - chain.time() + int((VEST_DURATION * 3) / 4))
    chain.mine()
    vestedEscrow.revoke(alice, {"from": admin})
    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(375_000)
    assert pytest.approx(vestedEscrow.vestedOf(treasury)) == scale(125_000)


def test_revoke_treasury_balance(
    mockToken, fundVestedEscrow, vestedEscrow, alice, admin, treasury
):
    chain.sleep(DELAY + int(VEST_DURATION / 2))
    chain.mine()
    vestedEscrow.revoke(alice, {"from": admin})
    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    vestedEscrow.claim(treasury, {"from": treasury})
    assert mockToken.balanceOf(treasury) / 1e18 == pytest.approx(125_000, 0.1)

    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    vestedEscrow.claim(treasury, {"from": treasury})
    assert mockToken.balanceOf(treasury) / 1e18 == pytest.approx(250_000, 0.1)


def test_revoke_multiple(
    mockToken, fundVestedEscrow, vestedEscrow, alice, bob, charlie, admin, treasury, startTime
):
    chain.mine()
    chain.sleep(startTime - chain.time() + int(VEST_DURATION / 4))
    chain.mine()
    vestedEscrow.revoke(alice, {"from": admin})

    chain.mine()
    chain.sleep(int(VEST_DURATION / 2) - (chain.time() - startTime))
    chain.mine()
    assert pytest.approx(vestedEscrow.balanceOf(treasury)) == scale(125_000)
    vestedEscrow.revoke(bob, {"from": admin})
    vestedEscrow.claim(treasury, {"from": treasury})
    assert pytest.approx(mockToken.balanceOf(treasury)) == scale(125_000)

    chain.mine()
    chain.sleep(int((VEST_DURATION * 3) / 4) - (chain.time() - startTime))
    chain.mine()
    assert pytest.approx(vestedEscrow.balanceOf(treasury)) == scale(187_500)
    vestedEscrow.revoke(charlie, {"from": admin})
    vestedEscrow.claim(treasury, {"from": treasury})
    assert pytest.approx(mockToken.balanceOf(treasury)) == scale(312_500)

    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    vestedEscrow.claim(treasury, {"from": treasury})
    assert pytest.approx(mockToken.balanceOf(treasury)) == scale(562_500)

    assert pytest.approx(vestedEscrow.vestedOf(alice)) == scale(125_000)
    assert pytest.approx(vestedEscrow.vestedOf(bob)) == scale(125_000)
    assert pytest.approx(vestedEscrow.vestedOf(charlie)) == scale((250_000 * 3) / 4)
    assert pytest.approx(vestedEscrow.vestedOf(treasury)) == scale(562_500)
