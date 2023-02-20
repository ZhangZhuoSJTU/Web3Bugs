import brownie
import pytest

from brownie import ZERO_ADDRESS, reverts
from support.constants import ADMIN_DELAY, Roles

pytestmark = pytest.mark.usefixtures("setup_keeper_gauge")

TEST_DELAY = 1 * 86400


@pytest.fixture
def setup_keeper_gauge(
    admin,
    keeperGauge,
    topUpActionFeeHandler,
    address_provider,
    inflation_manager,
    pool,
    minter,
    bkdToken,
    lpToken,
):
    inflation_manager.setKeeperGauge(pool, keeperGauge, {"from": admin})
    inflation_manager.setMinter(minter, {"from": admin})
    topUpActionFeeHandler.setInitialKeeperGaugeForToken(
        lpToken, keeperGauge, {"from": admin}
    )


def test_reporting_fees_correctly_updates_total_inflation(
    admin,
    keeperGauge,
    topUpActionFeeHandler,
    alice,
    bob,
    pool,
    chain,
    inflation_manager,
    minter,
    lpToken,
):

    # Setup the keeper pool weight (do here as this calls checkpoint)
    inflation_manager.prepareKeeperPoolWeight(pool, 0.5 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeKeeperPoolWeight(pool)
    startTimestamp = keeperGauge.lastUpdated()

    for i in range(5):
        topUpActionFeeHandler.callReportFees(alice, 1 * 1e18, lpToken)
        topUpActionFeeHandler.callReportFees(bob, 2 * 1e18, lpToken)

    inflation_manager.advanceKeeperGaugeEpoch(pool, {"from": admin})
    lastUpdateTimestamp = chain[-1]["timestamp"]

    keeperInflation = minter.getKeeperInflationRate()
    epochTotalInflationShould = keeperInflation * (lastUpdateTimestamp - startTimestamp)
    assert keeperGauge.perPeriodTotalInflation(0) == epochTotalInflationShould


def test_correct_inflation_share_per_keeper(
    admin,
    keeperGauge,
    topUpActionFeeHandler,
    alice,
    bob,
    pool,
    chain,
    inflation_manager,
    minter,
    lpToken,
):

    # Setup the keeper pool weight (do here as this calls checkpoint)
    inflation_manager.prepareKeeperPoolWeight(pool, 0.5 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeKeeperPoolWeight(pool)
    startTimestamp = keeperGauge.lastUpdated()

    keeperInflation = minter.getKeeperInflationRate()

    aliceInflationShould = 0
    alicePreviousWeight = 0

    previousTimeStamp = startTimestamp

    for i in range(5):
        topUpActionFeeHandler.callReportFees(alice, 1 * 1e18, lpToken)
        topUpActionFeeHandler.callReportFees(bob, 2 * 1e18, lpToken)
        inflation_manager.advanceKeeperGaugeEpoch(pool, {"from": admin})
        chain.sleep(TEST_DELAY)
        lastUpdateTimestamp = chain[-1]["timestamp"]
        aliceInflationShould += (
            keeperInflation * 1 / 3 * (lastUpdateTimestamp - previousTimeStamp)
        )
        previousTimeStamp = lastUpdateTimestamp

    predicted = keeperGauge.claimableRewards(alice)
    tx = keeperGauge.claimRewards(alice, {"from": alice})

    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == aliceInflationShould
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == predicted


def test_correct_keeper_inflation_interrupted_fee_reporting(
    admin,
    keeperGauge,
    topUpActionFeeHandler,
    alice,
    bob,
    pool,
    chain,
    inflation_manager,
    minter,
    lpToken,
):

    # Setup the keeper pool weight (do here as this calls checkpoint)
    inflation_manager.prepareKeeperPoolWeight(pool, 0.5 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeKeeperPoolWeight(pool)
    chain.sleep(TEST_DELAY)
    startTimestamp = keeperGauge.lastUpdated()

    keeperInflation = minter.getKeeperInflationRate()
    alice_inflation_should = 0
    bob_inflation_should = 0

    topUpActionFeeHandler.callReportFees(bob, 1e18, lpToken)
    topUpActionFeeHandler.callReportFees(alice, 1e18, lpToken)

    inflation_manager.advanceKeeperGaugeEpoch(pool, {"from": admin})
    firstEpochTimeStamp = chain[-1]["timestamp"]
    alice_inflation_should += (
        0.5 * keeperInflation * (firstEpochTimeStamp - startTimestamp)
    )
    bob_inflation_should += (
        0.5 * keeperInflation * (firstEpochTimeStamp - startTimestamp)
    )
    chain.sleep(TEST_DELAY)

    topUpActionFeeHandler.callReportFees(alice, 1e18, lpToken)

    inflation_manager.advanceKeeperGaugeEpoch(pool, {"from": admin})
    endTimeStamp = chain[-1]["timestamp"]
    alice_inflation_should += keeperInflation * (endTimeStamp - firstEpochTimeStamp)

    predicted_alice = keeperGauge.claimableRewards(alice)
    tx = keeperGauge.claimRewards(alice, {"from": alice})

    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"]) == alice_inflation_should
    )
    assert pytest.approx(predicted_alice) == alice_inflation_should

    predicted_bob = keeperGauge.claimableRewards(bob)
    tx = keeperGauge.claimRewards(bob, {"from": bob})

    assert tx.events["TokensMinted"][0]["beneficiary"] == bob
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == bob_inflation_should
    assert pytest.approx(predicted_bob) == bob_inflation_should


def test_claiming_works_after_kill(
    admin,
    keeperGauge,
    topUpActionFeeHandler,
    alice,
    bob,
    pool,
    chain,
    inflation_manager,
    minter,
    lpToken,
):

    # Setup the keeper pool weight (do here as this calls checkpoint)
    inflation_manager.prepareKeeperPoolWeight(pool, 0.5 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeKeeperPoolWeight(pool)
    chain.sleep(TEST_DELAY)
    startTimestamp = keeperGauge.lastUpdated()

    keeperInflation = minter.getKeeperInflationRate()
    alice_inflation_should = 0
    bob_inflation_should = 0

    topUpActionFeeHandler.callReportFees(bob, 1e18, lpToken)
    topUpActionFeeHandler.callReportFees(alice, 1e18, lpToken)

    inflation_manager.advanceKeeperGaugeEpoch(pool, {"from": admin})
    firstEpochTimeStamp = chain[-1]["timestamp"]
    alice_inflation_should += (
        0.5 * keeperInflation * (firstEpochTimeStamp - startTimestamp)
    )
    bob_inflation_should += (
        0.5 * keeperInflation * (firstEpochTimeStamp - startTimestamp)
    )
    chain.sleep(TEST_DELAY)

    topUpActionFeeHandler.callReportFees(alice, 1e18, lpToken)

    inflation_manager.callKillKeeperGauge(keeperGauge)
    endTimeStamp = chain[-1]["timestamp"]
    alice_inflation_should += keeperInflation * (endTimeStamp - firstEpochTimeStamp)

    predicted_alice = keeperGauge.claimableRewards(alice)
    tx = keeperGauge.claimRewards(alice, {"from": alice})

    assert tx.events["TokensMinted"][0]["beneficiary"] == alice
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert (
        pytest.approx(tx.events["TokensMinted"][0]["amount"]) == alice_inflation_should
    )
    assert pytest.approx(predicted_alice) == alice_inflation_should

    predicted_bob = keeperGauge.claimableRewards(bob)
    tx = keeperGauge.claimRewards(bob, {"from": bob})

    assert tx.events["TokensMinted"][0]["beneficiary"] == bob
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == tx.return_value
    assert pytest.approx(tx.events["TokensMinted"][0]["amount"]) == bob_inflation_should
    assert pytest.approx(predicted_bob) == bob_inflation_should


def test_set_zap(
    keeperGauge,
    alice,
    bob,
    chain,
    admin,
    charlie,
    inflation_manager,
    topUpActionFeeHandler,
    pool,
    minter,
    lpToken,
    role_manager,
):
    # Should be null by default
    assert role_manager.getRoleMemberCount(Roles.GAUGE_ZAP.value) == 0

    # Generating rewards
    inflation_manager.prepareKeeperPoolWeight(pool, 0.5 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeKeeperPoolWeight(pool)
    startTimestamp = keeperGauge.lastUpdated()
    keeperInflation = minter.getKeeperInflationRate()
    aliceInflationShould = 0
    previousTimeStamp = startTimestamp
    for i in range(5):
        topUpActionFeeHandler.callReportFees(alice, 1 * 1e18, lpToken)
        topUpActionFeeHandler.callReportFees(bob, 2 * 1e18, lpToken)
        inflation_manager.advanceKeeperGaugeEpoch(pool, {"from": admin})
        chain.sleep(TEST_DELAY)
        lastUpdateTimestamp = chain[-1]["timestamp"]
        aliceInflationShould += (
            keeperInflation * 1 / 3 * (lastUpdateTimestamp - previousTimeStamp)
        )
        previousTimeStamp = lastUpdateTimestamp

    # Should revert from non owner
    with reverts("unauthorized access"):
        keeperGauge.claimRewards(alice, {"from": bob})

    # Should revert setting zap from non-admin
    with reverts("unauthorized access"):
        role_manager.addGaugeZap(charlie, {"from": bob})

    # Should set zap
    role_manager.addGaugeZap(charlie, {"from": admin})
    assert role_manager.getRoleMember(Roles.GAUGE_ZAP.value, 0) == charlie

    # Should be able to claim on behalf of zap
    keeperGauge.claimRewards(alice, {"from": charlie})
