import brownie
import pytest

from support.constants import ADMIN_DELAY

pytestmark = pytest.mark.usefixtures("setup", "addInitialLiquidityTopUpAction")


@pytest.fixture
def setup(topUpActionFeeHandler, admin, chain):
    topUpActionFeeHandler.prepareKeeperFee(0.6 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    topUpActionFeeHandler.executeKeeperFee()


def test_pay_fees(alice, bob, topUpAction, lpToken, initialAmount):
    tx = topUpAction.testingPayFees(
        alice, bob, 0.05 * initialAmount, lpToken, {"from": alice}
    )
    assert tx.events["FeesPayed"][0]["payer"] == alice
    assert tx.events["FeesPayed"][0]["keeper"] == bob
    assert tx.events["FeesPayed"][0]["token"] == lpToken
    assert tx.events["FeesPayed"][0]["amount"] == 0.05 * initialAmount
    assert (
        pytest.approx(tx.events["FeesPayed"][0]["keeperAmount"]) == 0.03 * initialAmount
    )
    assert pytest.approx(tx.events["FeesPayed"][0]["lpAmount"]) == 0.02 * initialAmount


def claim_keeper_fees_for_pool_single_keeper(
    alice, bob, topUpAction, topUpActionFeeHandler, lpToken
):
    num_fees_per_epoch = 5
    num_epochs = 5

    for i in range(num_epochs):
        for j in range(num_fees_per_epoch):
            _ = topUpAction.testingPayFees(alice, bob, 50, lpToken, {"from": alice})

    previous_balance = lpToken.balanceOf(bob)
    tx = topUpActionFeeHandler.claimKeeperFeesForPool(bob, lpToken, {"from": bob})
    new_balance = lpToken.balanceOf(bob)
    assert tx.events["KeeperFeesClaimed"][0]["keeper"] == bob
    assert tx.events["KeeperFeesClaimed"][0]["token"] == lpToken
    assert tx.events["KeeperFeesClaimed"][0]["totalClaimed"] == 750
    assert new_balance - previous_balance == 750


def test_claim_keeper_fees_for_pool_single_keeper(
    alice, bob, topUpAction, topUpActionFeeHandler, lpToken
):
    claim_keeper_fees_for_pool_single_keeper(
        alice, bob, topUpAction, topUpActionFeeHandler, lpToken
    )


@pytest.mark.usefixtures("inflation_kickoff")
def test_claim_keeper_fees_for_pool_single_keeper_with_inflation(
    alice, bob, topUpAction, topUpActionFeeHandler, lpToken, mockKeeperGauge
):
    assert mockKeeperGauge.perPeriodTotalFees(0) == 0
    claim_keeper_fees_for_pool_single_keeper(
        alice, bob, topUpAction, topUpActionFeeHandler, lpToken
    )
    assert mockKeeperGauge.perPeriodTotalFees(0) == 750


def claim_keeper_fees_for_pool_multiple_keepers(
    alice, bob, charlie, topUpAction, topUpActionFeeHandler, lpToken
):
    num_fees_per_epoch_bob = 5
    num_fees_per_epoch_charlie = 3
    num_epochs = 5

    for i in range(num_epochs):
        for j in range(num_fees_per_epoch_bob):
            _ = topUpAction.testingPayFees(alice, bob, 50, lpToken, {"from": alice})

        for k in range(num_fees_per_epoch_charlie):
            _ = topUpAction.testingPayFees(
                alice, charlie, 100, lpToken, {"from": alice}
            )

    tx = topUpActionFeeHandler.claimKeeperFeesForPool(bob, lpToken, {"from": bob})
    assert tx.events["KeeperFeesClaimed"][0]["keeper"] == bob
    assert tx.events["KeeperFeesClaimed"][0]["token"] == lpToken
    assert tx.events["KeeperFeesClaimed"][0]["totalClaimed"] == 750

    tx = topUpActionFeeHandler.claimKeeperFeesForPool(
        charlie, lpToken, {"from": charlie}
    )
    assert tx.events["KeeperFeesClaimed"][0]["keeper"] == charlie
    assert tx.events["KeeperFeesClaimed"][0]["token"] == lpToken
    assert tx.events["KeeperFeesClaimed"][0]["totalClaimed"] == 900


def test_claim_keeper_fees_for_pool_multiple_keepers(
    alice, bob, charlie, topUpAction, topUpActionFeeHandler, lpToken
):
    claim_keeper_fees_for_pool_multiple_keepers(
        alice, bob, charlie, topUpAction, topUpActionFeeHandler, lpToken
    )


@pytest.mark.usefixtures("inflation_kickoff")
def test_claim_keeper_fees_for_pool_multiple_keepers_with_inflation(
    alice, bob, charlie, topUpAction, topUpActionFeeHandler, lpToken, mockKeeperGauge
):
    assert mockKeeperGauge.perPeriodTotalFees(0) == 0
    claim_keeper_fees_for_pool_multiple_keepers(
        alice, bob, charlie, topUpAction, topUpActionFeeHandler, lpToken
    )
    assert mockKeeperGauge.perPeriodTotalFees(0) == 1650


def test_claim_keeper_fees_for_pool_multiple_keepers_claim_twice(
    alice, bob, charlie, topUpAction, topUpActionFeeHandler, lpToken
):
    num_fees_per_epoch_bob = 5
    num_fees_per_epoch_charlie = 3
    num_epochs = 5

    for i in range(num_epochs):
        for j in range(num_fees_per_epoch_bob):
            _ = topUpAction.testingPayFees(alice, bob, 50, lpToken, {"from": alice})

        for k in range(num_fees_per_epoch_charlie):
            _ = topUpAction.testingPayFees(
                alice, charlie, 100, lpToken, {"from": alice}
            )

    tx = topUpActionFeeHandler.claimKeeperFeesForPool(bob, lpToken, {"from": bob})
    assert tx.events["KeeperFeesClaimed"][0]["keeper"] == bob
    assert tx.events["KeeperFeesClaimed"][0]["token"] == lpToken
    assert tx.events["KeeperFeesClaimed"][0]["totalClaimed"] == 750

    tx = topUpActionFeeHandler.claimKeeperFeesForPool(
        charlie, lpToken, {"from": charlie}
    )
    assert tx.events["KeeperFeesClaimed"][0]["keeper"] == charlie
    assert tx.events["KeeperFeesClaimed"][0]["token"] == lpToken
    assert tx.events["KeeperFeesClaimed"][0]["totalClaimed"] == 900

    _ = topUpAction.testingPayFees(alice, bob, 50, lpToken, {"from": alice})

    tx = topUpActionFeeHandler.claimKeeperFeesForPool(bob, lpToken, {"from": bob})

    assert tx.events["KeeperFeesClaimed"][0]["keeper"] == bob
    assert tx.events["KeeperFeesClaimed"][0]["token"] == lpToken
    assert tx.events["KeeperFeesClaimed"][0]["totalClaimed"] == 30


def claim_keeper_fees_for_pool_multiple_keepers_different_zero_periods_claimed(
    alice, bob, charlie, topUpAction, topUpActionFeeHandler, lpToken
):
    num_fees_per_epoch_bob = 5
    num_fees_per_epoch_charlie = 3

    epoch_start_bob = 2
    epoch_start_charlie = 1

    num_epochs = 5

    for i in range(num_epochs):
        if i >= epoch_start_bob:
            for j in range(num_fees_per_epoch_bob):
                _ = topUpAction.testingPayFees(alice, bob, 50, lpToken, {"from": alice})
        if i >= epoch_start_charlie:
            for k in range(num_fees_per_epoch_charlie):
                _ = topUpAction.testingPayFees(
                    alice, charlie, 100, lpToken, {"from": alice}
                )

    tx = topUpActionFeeHandler.claimKeeperFeesForPool(bob, lpToken, {"from": bob})
    assert tx.events["KeeperFeesClaimed"][0]["keeper"] == bob
    assert tx.events["KeeperFeesClaimed"][0]["token"] == lpToken
    assert tx.events["KeeperFeesClaimed"][0]["totalClaimed"] == 450

    tx = topUpActionFeeHandler.claimKeeperFeesForPool(
        charlie, lpToken, {"from": charlie}
    )
    assert tx.events["KeeperFeesClaimed"][0]["keeper"] == charlie
    assert tx.events["KeeperFeesClaimed"][0]["token"] == lpToken
    assert tx.events["KeeperFeesClaimed"][0]["totalClaimed"] == 720


def test_claim_keeper_fees_for_pool_multiple_keepers_different_zero_periods_claimed(
    alice, bob, charlie, topUpAction, topUpActionFeeHandler, lpToken
):
    claim_keeper_fees_for_pool_multiple_keepers_different_zero_periods_claimed(
        alice, bob, charlie, topUpAction, topUpActionFeeHandler, lpToken
    )


@pytest.mark.usefixtures("inflation_kickoff")
def test_claim_keeper_fees_for_pool_multiple_keepers_different_zero_periods_claimed_with_inflation(
    alice, bob, charlie, topUpAction, topUpActionFeeHandler, lpToken, mockKeeperGauge
):
    assert mockKeeperGauge.perPeriodTotalFees(0) == 0
    claim_keeper_fees_for_pool_multiple_keepers_different_zero_periods_claimed(
        alice, bob, charlie, topUpAction, topUpActionFeeHandler, lpToken
    )
    assert mockKeeperGauge.perPeriodTotalFees(0) == 1170


def test_claim_keeper_fees_with_already_claimed_fees(
    alice, bob, topUpAction, topUpActionFeeHandler, lpToken
):
    num_fees_per_epoch = 5
    num_epochs = 5

    for _ in range(num_epochs):
        for _ in range(num_fees_per_epoch):
            topUpAction.testingPayFees(alice, bob, 50, lpToken, {"from": alice})

    previous_balance = lpToken.balanceOf(bob)
    topUpActionFeeHandler.claimKeeperFeesForPool(bob, lpToken, {"from": bob})
    new_balance = lpToken.balanceOf(bob)
    with brownie.reverts("there is no claimable balance"):
        topUpActionFeeHandler.claimKeeperFeesForPool(bob, lpToken, {"from": bob})
    assert new_balance - previous_balance == 750


def test_unauthorized_fee_payment_reverts(alice, topUpActionFeeHandler, bob, lpToken):
    with brownie.reverts("unauthorized access"):
        topUpActionFeeHandler.payFees(bob, alice, 50, lpToken, {"from": alice})
