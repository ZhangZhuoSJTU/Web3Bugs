import pytest
import brownie
from brownie import ZERO_ADDRESS

from support.constants import ADMIN_DELAY


def test_set_keeper_gauge_first_time(inflation_manager, mockKeeperGauge, admin, pool):
    inflation_manager.setKeeperGauge(pool, mockKeeperGauge, {"from": admin})
    assert inflation_manager.getKeeperGaugeForPool(pool) == mockKeeperGauge
    assert inflation_manager.gauges(mockKeeperGauge) == True
    assert mockKeeperGauge.killed() == False


def test_set_keeper_gauge_second_time(
    inflation_manager, mockKeeperGauge, MockKeeperGauge, admin, minter, pool
):
    secondKeeperGauge = admin.deploy(MockKeeperGauge, inflation_manager, pool)

    inflation_manager.setKeeperGauge(pool, mockKeeperGauge, {"from": admin})
    assert inflation_manager.getKeeperGaugeForPool(pool) == mockKeeperGauge
    assert inflation_manager.gauges(mockKeeperGauge) == True
    assert mockKeeperGauge.killed() == False

    inflation_manager.setKeeperGauge(pool, secondKeeperGauge, {"from": admin})
    assert inflation_manager.getKeeperGaugeForPool(pool) == secondKeeperGauge
    assert inflation_manager.gauges(secondKeeperGauge) == True
    assert inflation_manager.gauges(mockKeeperGauge) == True
    assert mockKeeperGauge.killed() == True
    assert secondKeeperGauge.killed() == False


def test_set_amm_gauge_first_time(inflation_manager, mockAmmGauge, admin, mockAmmToken):
    inflation_manager.setAmmGauge(mockAmmToken, mockAmmGauge, {"from": admin})
    assert inflation_manager.getAmmGaugeForToken(mockAmmToken) == mockAmmGauge
    assert inflation_manager.gauges(mockAmmGauge) == True
    assert mockAmmGauge.killed() == False


def test_set_keeper_gauge_non_admin_fails(inflation_manager, mockAmmGauge, alice, pool):
    with brownie.reverts("unauthorized access"):
        inflation_manager.setKeeperGauge(pool, mockAmmGauge, {"from": alice})


def test_set_amm_gauge_second_time(
    inflation_manager,
    mockAmmGauge,
    MockAmmGauge,
    admin,
    minter,
    mockAmmToken,
    alice,
    controller,
):
    secondAmmGauge = admin.deploy(MockAmmGauge, controller, mockAmmToken)

    inflation_manager.setAmmGauge(mockAmmToken, mockAmmGauge, {"from": admin})
    assert inflation_manager.getAmmGaugeForToken(mockAmmToken) == mockAmmGauge
    assert inflation_manager.gauges(mockAmmGauge) == True
    assert mockAmmGauge.killed() == False

    inflation_manager.setAmmGauge(mockAmmToken, secondAmmGauge, {"from": admin})
    assert inflation_manager.getAmmGaugeForToken(mockAmmToken) == secondAmmGauge
    assert inflation_manager.gauges(secondAmmGauge) == True
    assert inflation_manager.gauges(mockAmmGauge) == True
    assert mockAmmGauge.killed() == True
    assert secondAmmGauge.killed() == False


def test_set_keeper_pool_weight(
    inflation_manager, admin, chain, pool, mockKeeperGauge, bob
):
    inflation_manager.setKeeperGauge(pool, mockKeeperGauge, {"from": admin})
    inflation_manager.prepareKeeperPoolWeight(pool, 0.4 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeKeeperPoolWeight(pool, {"from": admin})
    assert inflation_manager.getKeeperWeightForPool(pool) == 0.4 * 1e18


def test_set_lp_token_weight(
    address_provider,
    inflation_manager,
    admin,
    chain,
    lpToken,
    stakerVault,
    lpGauge,
    pool,
):
    address_provider.addPool(pool, {"from": admin})
    inflation_manager.prepareLpPoolWeight(lpToken, 0.4 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeLpPoolWeight(lpToken, {"from": admin})
    assert inflation_manager.getLpPoolWeight(lpToken) == 0.4 * 1e18


def test_set_amm_token_weight(
    inflation_manager, admin, chain, bob, mockAmmGauge, mockAmmToken
):
    inflation_manager.setAmmGauge(mockAmmToken, mockAmmGauge, {"from": admin})
    inflation_manager.prepareAmmTokenWeight(mockAmmToken, 0.4 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeAmmTokenWeight(mockAmmToken, {"from": admin})
    assert inflation_manager.getAmmWeightForToken(mockAmmToken) == 0.4 * 1e18


def test_remove_amm_gauge(
    inflation_manager,
    mockAmmGauge,
    MockAmmGauge,
    admin,
    minter,
    bob,
    mockAmmToken,
    controller,
):
    secondAmmGauge = admin.deploy(MockAmmGauge, controller, mockAmmToken)
    thirdAmmGauge = admin.deploy(MockAmmGauge, controller, mockAmmToken)

    inflation_manager.setAmmGauge(mockAmmToken, mockAmmGauge, {"from": admin})
    assert inflation_manager.getAmmGaugeForToken(mockAmmToken) == mockAmmGauge
    assert inflation_manager.gauges(mockAmmGauge) == True
    assert mockAmmGauge.killed() == False
    inflation_manager.removeAmmGauge(mockAmmToken, {"from": admin})
    assert mockAmmGauge.killed() == True
    assert inflation_manager.getAmmGaugeForToken(mockAmmToken) == ZERO_ADDRESS

    inflation_manager.setAmmGauge(mockAmmToken, secondAmmGauge, {"from": admin})
    assert inflation_manager.getAmmGaugeForToken(mockAmmToken) == secondAmmGauge
    assert inflation_manager.gauges(secondAmmGauge) == True

    assert inflation_manager.gauges(mockAmmGauge) == True
    assert mockAmmGauge.killed() == True
    assert secondAmmGauge.killed() == False
    assert thirdAmmGauge.killed() == False


def test_remove_keeper_gauge(
    inflation_manager, mockKeeperGauge, MockKeeperGauge, admin, minter, pool, bob
):
    secondKeeperGauge = admin.deploy(MockKeeperGauge, inflation_manager, bob)

    inflation_manager.setKeeperGauge(pool, mockKeeperGauge, {"from": admin})
    assert inflation_manager.getKeeperGaugeForPool(pool) == mockKeeperGauge
    assert inflation_manager.gauges(mockKeeperGauge) == True
    assert mockKeeperGauge.killed() == False

    inflation_manager.removeKeeperGauge(pool, {"from": admin})
    assert mockKeeperGauge.killed() == True
    assert inflation_manager.getKeeperGaugeForPool(pool) == ZERO_ADDRESS

    inflation_manager.setKeeperGauge(bob, secondKeeperGauge, {"from": admin})
    assert inflation_manager.getKeeperGaugeForPool(bob) == secondKeeperGauge
    assert inflation_manager.gauges(secondKeeperGauge) == True
    assert inflation_manager.gauges(mockKeeperGauge) == True
    assert mockKeeperGauge.killed() == True
    assert secondKeeperGauge.killed() == False


def test_set_two_keeper_gauges(
    inflation_manager, mockKeeperGauge, MockKeeperGauge, admin, minter, pool, bob
):
    secondKeeperGauge = admin.deploy(MockKeeperGauge, inflation_manager, bob)

    inflation_manager.setKeeperGauge(pool, mockKeeperGauge, {"from": admin})
    assert inflation_manager.getKeeperGaugeForPool(pool) == mockKeeperGauge
    assert inflation_manager.gauges(mockKeeperGauge) == True

    inflation_manager.setKeeperGauge(bob, secondKeeperGauge, {"from": admin})
    assert inflation_manager.getKeeperGaugeForPool(bob) == secondKeeperGauge
    assert inflation_manager.gauges(secondKeeperGauge) == True
    assert inflation_manager.gauges(mockKeeperGauge) == True
    assert mockKeeperGauge.killed() == False
    assert secondKeeperGauge.killed() == False


def test_set_two_amm_gauges(
    inflation_manager, mockAmmGauge, MockAmmGauge, admin, minter, mockAmmToken, alice
):
    secondAmmGauge = admin.deploy(MockAmmGauge, inflation_manager, alice)

    inflation_manager.setAmmGauge(mockAmmToken, mockAmmGauge, {"from": admin})
    assert inflation_manager.getAmmGaugeForToken(mockAmmToken) == mockAmmGauge
    assert inflation_manager.gauges(mockAmmGauge) == True
    assert inflation_manager.getAmmGaugeForToken(mockAmmToken) == mockAmmGauge
    assert mockAmmGauge.killed() == False

    inflation_manager.setAmmGauge(alice, secondAmmGauge, {"from": admin})
    assert inflation_manager.getAmmGaugeForToken(alice) == secondAmmGauge
    assert inflation_manager.gauges(secondAmmGauge) == True
    assert inflation_manager.gauges(mockAmmGauge) == True
    assert mockAmmGauge.killed() == False
    assert secondAmmGauge.killed() == False


def test_transition_to_one_keeper_gauge(
    controller,
    address_provider,
    inflation_manager,
    minter,
    mockKeeperGauge,
    admin,
    MockKeeperGauge,
    pool,
    bob,
    chain,
    LpToken,
    EthPool,
):
    otherPool = admin.deploy(EthPool, controller)
    otherLpToken = admin.deploy(LpToken)
    otherPool.initialize("eth-pool", ZERO_ADDRESS)
    otherLpToken.initialize("Other LP", "OLP", 18, otherPool)
    otherPool.setLpToken(otherLpToken, {"from": admin})

    secondKeeperGauge = admin.deploy(MockKeeperGauge, controller, otherPool)
    singleKeeperGauge = admin.deploy(MockKeeperGauge, controller, otherPool)

    # Initial setup with two gauges
    address_provider.addPool(pool, {"from": admin})
    address_provider.addPool(otherPool, {"from": admin})
    inflation_manager.setKeeperGauge(pool, mockKeeperGauge, {"from": admin})
    inflation_manager.setKeeperGauge(otherPool, secondKeeperGauge, {"from": admin})
    assert inflation_manager.getKeeperGaugeForPool(pool) == mockKeeperGauge
    assert inflation_manager.getKeeperGaugeForPool(otherPool) == secondKeeperGauge
    assert inflation_manager.gauges(mockKeeperGauge) == True
    assert inflation_manager.gauges(secondKeeperGauge) == True
    inflation_manager.setMinter(minter, {"from": admin})
    inflation_manager.batchPrepareKeeperPoolWeights(
        [pool, otherPool], [0.2 * 1e18, 0.3 * 1e18], {"from": admin}
    )
    chain.sleep(ADMIN_DELAY)
    inflation_manager.batchExecuteKeeperPoolWeights([pool, otherPool])
    assert inflation_manager.getKeeperWeightForPool(pool) == 0.2 * 1e18
    assert inflation_manager.getKeeperWeightForPool(otherPool) == 0.3 * 1e18
    assert (
        pytest.approx(inflation_manager.getKeeperRateForPool(pool))
        == 0.4 * minter.getKeeperInflationRate()
    )
    assert (
        pytest.approx(inflation_manager.getKeeperRateForPool(otherPool))
        == 0.6 * minter.getKeeperInflationRate()
    )

    # Transition to single gauge logic
    inflation_manager.deactivateWeightBasedKeeperDistribution({"from": admin})
    inflation_manager.setKeeperGauge(pool, singleKeeperGauge, {"from": admin})
    inflation_manager.setKeeperGauge(otherPool, singleKeeperGauge, {"from": admin})

    assert inflation_manager.gauges(mockKeeperGauge) == True
    assert inflation_manager.gauges(secondKeeperGauge) == True
    assert inflation_manager.gauges(singleKeeperGauge) == True
    assert inflation_manager.getKeeperGaugeForPool(pool) == singleKeeperGauge
    assert inflation_manager.getKeeperGaugeForPool(otherPool) == singleKeeperGauge
    assert inflation_manager.totalKeeperPoolWeight() == 0
