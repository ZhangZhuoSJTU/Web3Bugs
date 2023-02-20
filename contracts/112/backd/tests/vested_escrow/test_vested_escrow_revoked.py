import time
import brownie
import pytest
from brownie import chain
from brownie.test import given, strategy


VEST_DURATION = 365 * 86400
TOTAL_AMOUNT = 1_000_000 * 10 ** 18
DELAY = 86400 * 10
START_TIME = int(time.time()) + DELAY

ALICE_AMOUNT = TOTAL_AMOUNT / 2
BOB_AMOUNT = TOTAL_AMOUNT / 4
CHARLIE_AMOUNT = TOTAL_AMOUNT / 4


@pytest.fixture(scope="module")
def vestedEscrow(VestedEscrowRevocable, admin, mockToken, alice, treasury):
    return admin.deploy(
        VestedEscrowRevocable,
        mockToken,
        START_TIME,
        START_TIME + VEST_DURATION,
        alice,
        treasury,
    )


@pytest.fixture(scope="module")
def fundVestedEscrow(mockToken, vestedEscrow, alice, bob, charlie, admin):
    mockToken.mint_for_testing(vestedEscrow, TOTAL_AMOUNT)
    vestedEscrow.initializeUnallocatedSupply({"from": admin})
    vestedEscrow.fund(
        [(alice, ALICE_AMOUNT), (bob, BOB_AMOUNT), (charlie, CHARLIE_AMOUNT)]
    )


def test_locked_of(fundVestedEscrow, vestedEscrow, alice, bob, charlie, admin):
    assert vestedEscrow.lockedSupply() == TOTAL_AMOUNT
    chain.mine(1, int(START_TIME + VEST_DURATION / 2))
    assert vestedEscrow.lockedOf(alice) == 250_000 * 10 ** 18
    assert vestedEscrow.lockedOf(bob) == 125_000 * 10 ** 18
    assert vestedEscrow.lockedOf(charlie) == 125_000 * 10 ** 18


def test_vested_of(fundVestedEscrow, vestedEscrow, alice, bob, charlie, admin):
    assert vestedEscrow.lockedSupply() == TOTAL_AMOUNT

    chain.mine(1, int(START_TIME + VEST_DURATION / 4))
    assert vestedEscrow.lockedOf(alice) == 375_000 * 10 ** 18
    assert vestedEscrow.vestedOf(alice) == 125_000 * 10 ** 18

    chain.mine(1, int(START_TIME + VEST_DURATION / 2))
    assert vestedEscrow.lockedOf(alice) == 250_000 * 10 ** 18
    assert vestedEscrow.vestedOf(alice) == 250_000 * 10 ** 18
    assert vestedEscrow.vestedOf(bob) == 125_000 * 10 ** 18
    assert vestedEscrow.vestedOf(charlie) == 125_000 * 10 ** 18


def test_balance_of(fundVestedEscrow, vestedEscrow, alice, bob, charlie):
    chain.mine(1, int(START_TIME + VEST_DURATION / 4))
    assert vestedEscrow.lockedOf(alice) == 375_000 * 10 ** 18
    assert vestedEscrow.balanceOf(alice) == 125_000 * 10 ** 18

    chain.mine(1, int(START_TIME + VEST_DURATION / 2))
    assert vestedEscrow.lockedOf(alice) == 250_000 * 10 ** 18
    assert vestedEscrow.balanceOf(alice) == 250_000 * 10 ** 18
    assert vestedEscrow.balanceOf(bob) == 125_000 * 10 ** 18
    assert vestedEscrow.balanceOf(charlie) == 125_000 * 10 ** 18

    chain.mine(1, int(START_TIME + VEST_DURATION / 4 * 3))
    assert vestedEscrow.lockedOf(alice) == 125_000 * 10 ** 18
    assert vestedEscrow.balanceOf(alice) == 375_000 * 10 ** 18

    chain.mine(1, int(START_TIME + VEST_DURATION))
    assert vestedEscrow.lockedOf(alice) == 0
    assert vestedEscrow.balanceOf(alice) == 500_000 * 10 ** 18
    assert vestedEscrow.vestedOf(alice) == 500_000 * 10 ** 18

    assert vestedEscrow.lockedOf(bob) == 0
    assert vestedEscrow.balanceOf(bob) == 250_000 * 10 ** 18
    assert vestedEscrow.vestedOf(bob) == 250_000 * 10 ** 18

    assert vestedEscrow.lockedOf(charlie) == 0
    assert vestedEscrow.balanceOf(charlie) == 250_000 * 10 ** 18
    assert vestedEscrow.vestedOf(charlie) == 250_000 * 10 ** 18


def test_claim(fundVestedEscrow, mockToken, vestedEscrow, alice):
    chain.sleep(DELAY + int(VEST_DURATION / 2))
    chain.mine()
    assert vestedEscrow.balanceOf(alice) / 1e18 == pytest.approx(250_000, 0.001)
    assert vestedEscrow.lockedOf(alice) / 1e18 == pytest.approx(250_000, 0.001)
    vestedEscrow.claim({"from": alice})
    assert vestedEscrow.balanceOf(alice) == 0
    alice_holdings = vestedEscrow.holdingContract(alice)
    assert mockToken.balanceOf(alice_holdings) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 - 250_000, 0.001
    )
    assert mockToken.balanceOf(alice) / 1e18 == pytest.approx(250_000, 0.001)


def test_vest_and_claim(mockToken, fundVestedEscrow, vestedEscrow, alice):
    chain.sleep(DELAY + int(VEST_DURATION / 4))
    chain.mine()
    assert vestedEscrow.lockedOf(alice) / 1e18 == pytest.approx(375_000, 0.001)
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(125_000, 0.001)
    vestedEscrow.claim({"from": alice})
    assert mockToken.balanceOf(alice) / 1e18 == pytest.approx(125_000, 0.001)
    alice_holdings = vestedEscrow.holdingContract(alice)
    assert mockToken.balanceOf(alice_holdings) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 - 125_000, 0.001
    )

    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    assert vestedEscrow.lockedOf(alice) / 1e18 == pytest.approx(250_000, 0.001)
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(250_000, 0.001)
    assert vestedEscrow.balanceOf(alice) / 1e18 == pytest.approx(125_000, 0.001)


@given(duration=strategy("uint", min_value=1, max_value=1000))
def test_vested_supply(mockToken, fundVestedEscrow, duration, vestedEscrow):
    chain.sleep(int(VEST_DURATION / duration))
    chain.mine()
    assert vestedEscrow.vestedSupply() / 1e18 == pytest.approx(
        TOTAL_AMOUNT / 1e18 / duration, 1
    )


def test_revoke(fundVestedEscrow, vestedEscrow, alice, admin):
    chain.sleep(DELAY + int(VEST_DURATION / 2))
    chain.mine()
    assert vestedEscrow.balanceOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 2, 0.1
    )
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 2, 0.1
    )

    vestedEscrow.revoke(alice, {"from": admin})
    chain.sleep(DELAY + int(VEST_DURATION / 4))
    chain.mine()
    assert vestedEscrow.balanceOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 2, 0.1
    )
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 2, 0.1
    )

    chain.sleep(DELAY + int(VEST_DURATION / 4))
    chain.mine()
    assert vestedEscrow.balanceOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 2, 0.1
    )
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 2, 0.1
    )


def test_revoke_revert(vestedEscrow, alice, bob):
    with brownie.reverts():
        vestedEscrow.revoke(bob, {"from": alice})


def test_revoke_and_claim(
    mockToken, fundVestedEscrow, vestedEscrow, alice, admin, treasury
):
    chain.sleep(DELAY + int(VEST_DURATION / 2))
    chain.mine()
    assert vestedEscrow.balanceOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 2e18, 0.001
    )
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 2e18, 0.001
    )

    vestedEscrow.revoke(alice, {"from": admin})
    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    assert vestedEscrow.balanceOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 2, 0.1
    )
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 2, 0.1
    )
    vestedEscrow.claim({"from": alice})
    assert vestedEscrow.balanceOf(alice) == 0
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 2, 0.1
    )

    assert vestedEscrow.totalClaimed(treasury) == vestedEscrow.vestedOf(alice)
    vestedEscrow.claim(treasury, {"from": treasury})
    assert mockToken.balanceOf(treasury) / 1e18 == pytest.approx(125_000, 1)

    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    assert vestedEscrow.balanceOf(alice) == 0
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 2, 0.1
    )

    vestedEscrow.claim(treasury, {"from": treasury})
    assert mockToken.balanceOf(treasury) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 2, 0.1
    )

    assert vestedEscrow.lockedSupply() == 0


def test_locked_of_revoked(fundVestedEscrow, vestedEscrow, alice, admin):
    chain.sleep(DELAY + int(VEST_DURATION / 2))
    chain.mine()
    assert int(vestedEscrow.balanceOf(alice)) == pytest.approx(ALICE_AMOUNT / 2, 0.001)
    assert int(vestedEscrow.vestedOf(alice)) == pytest.approx(ALICE_AMOUNT / 2, 0.001)

    assert vestedEscrow.lockedOf(alice) != 0
    vestedEscrow.revoke(alice, {"from": admin})
    assert vestedEscrow.lockedOf(alice) == 0


def test_revoke_balance_of(
    mockToken, fundVestedEscrow, vestedEscrow, alice, admin, treasury
):
    chain.sleep(DELAY + int(VEST_DURATION / 2))
    chain.mine()
    alice_holdings = vestedEscrow.holdingContract(alice)

    assert mockToken.balanceOf(alice_holdings) == ALICE_AMOUNT

    vestedEscrow.revoke(alice, {"from": admin})

    assert mockToken.balanceOf(alice_holdings) == vestedEscrow.vestedOf(alice)

    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()

    assert mockToken.balanceOf(alice_holdings) == vestedEscrow.vestedOf(alice)

    assert vestedEscrow.balanceOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 2 / 1e18, 0.1
    )
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 2 / 1e18, 0.1
    )
    assert vestedEscrow.balanceOf(treasury) / 1e18 == pytest.approx(125_000, 0.1)

    vestedEscrow.claim({"from": alice})

    assert mockToken.balanceOf(alice_holdings) == 0
    assert vestedEscrow.balanceOf(alice) == 0
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 2 / 1e18, 0.1
    )

    assert vestedEscrow.totalClaimed(treasury) == vestedEscrow.vestedOf(alice)
    vestedEscrow.claim(treasury, {"from": treasury})
    assert mockToken.balanceOf(treasury) / 1e18 == pytest.approx(125_000, 0.1)
    assert vestedEscrow.balanceOf(alice) == 0

    chain.sleep(int(VEST_DURATION))
    chain.mine()
    assert vestedEscrow.balanceOf(alice) == 0
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 2 / 1e18, 0.1
    )
    assert vestedEscrow.balanceOf(treasury) / 1e18 == pytest.approx(125_000, 0.1)
    assert vestedEscrow.vestedOf(treasury) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 2 / 1e18, 0.1
    )
    vestedEscrow.claim(alice, {"from": alice})
    assert vestedEscrow.balanceOf(alice) == 0


def test_treasury_vested_of(fundVestedEscrow, vestedEscrow, alice, admin, treasury):
    chain.sleep(DELAY + int(VEST_DURATION / 4 * 3))
    chain.mine()
    vestedEscrow.revoke(alice, {"from": admin})
    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    assert vestedEscrow.vestedOf(alice) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 4 * 3, 0.1
    )
    assert vestedEscrow.vestedOf(treasury) / 1e18 == pytest.approx(
        ALICE_AMOUNT / 1e18 / 4, 0.1
    )


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
    mockToken, fundVestedEscrow, vestedEscrow, alice, bob, charlie, admin, treasury
):
    chain.sleep(DELAY + int(VEST_DURATION / 4))
    chain.mine()
    vestedEscrow.revoke(alice, {"from": admin})

    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    assert vestedEscrow.balanceOf(treasury) / 1e18 == pytest.approx(125_000, 0.001)
    vestedEscrow.revoke(bob, {"from": admin})
    vestedEscrow.claim(treasury, {"from": treasury})
    assert mockToken.balanceOf(treasury) / 1e18 == pytest.approx(125_000, 0.001)

    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    assert vestedEscrow.balanceOf(treasury) / 1e18 == pytest.approx(187_500, 0.001)
    vestedEscrow.revoke(charlie, {"from": admin})
    vestedEscrow.claim(treasury, {"from": treasury})
    assert mockToken.balanceOf(treasury) / 1e18 == pytest.approx(312_250, 0.001)

    chain.sleep(int(VEST_DURATION / 4))
    chain.mine()
    vestedEscrow.claim(treasury, {"from": treasury})
    assert mockToken.balanceOf(treasury) / 1e18 == pytest.approx(562_500, 0.1)

    assert int(vestedEscrow.vestedOf(alice)) == pytest.approx(ALICE_AMOUNT / 4, 0.001)
    assert vestedEscrow.vestedOf(bob) / 1e18 == pytest.approx(250_000 / 2, 0.001)
    assert vestedEscrow.vestedOf(charlie) / 1e18 == pytest.approx(
        250_000 / 4 * 3, 0.001
    )
    assert vestedEscrow.vestedOf(treasury) / 1e18 == pytest.approx(562_500, 0.001)
