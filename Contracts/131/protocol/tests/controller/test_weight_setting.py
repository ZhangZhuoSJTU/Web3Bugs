from brownie.test.managers.runner import RevertContextManager as reverts
import pytest

from support.constants import ADMIN_DELAY, Roles

pytestmark = pytest.mark.usefixtures("setup_controller")


@pytest.fixture
def otherMockAmmGauge(admin, MockAmmGauge, controller, bob):
    return admin.deploy(MockAmmGauge, controller, bob)


@pytest.fixture
def otherMockKeeperGauge(admin, MockKeeperGauge, controller, pool):
    return admin.deploy(MockKeeperGauge, controller, pool)


@pytest.fixture
def setup_controller(
    inflation_manager,
    address_provider,
    admin,
    mockKeeperGauge,
    otherMockKeeperGauge,
    minter,
    pool,
    cappedPool,
):
    inflation_manager.setKeeperGauge(pool, mockKeeperGauge, {"from": admin})
    inflation_manager.setKeeperGauge(cappedPool, otherMockKeeperGauge, {"from": admin})
    inflation_manager.setMinter(minter, {"from": admin})
    address_provider.addPool(pool, {"from": admin})
    address_provider.addPool(cappedPool, {"from": admin})


def test_set_keeper_pool_weight(admin, inflation_manager, chain, pool):
    assert inflation_manager.getKeeperWeightForPool(pool) == 0
    assert inflation_manager.totalKeeperPoolWeight() == 0
    inflation_manager.prepareKeeperPoolWeight(pool, 0.3 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeKeeperPoolWeight(pool)
    assert inflation_manager.totalKeeperPoolWeight() == 0.3 * 1e18
    assert inflation_manager.getKeeperWeightForPool(pool) == 0.3 * 1e18


def test_set_keeper_pool_weight_larger_one(
    admin, inflation_manager, chain, minter, pool
):
    assert inflation_manager.getKeeperWeightForPool(pool) == 0
    assert inflation_manager.totalKeeperPoolWeight() == 0
    inflation_manager.prepareKeeperPoolWeight(pool, 2 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeKeeperPoolWeight(pool)
    assert inflation_manager.totalKeeperPoolWeight() == 2 * 1e18
    assert inflation_manager.getKeeperWeightForPool(pool) == 2 * 1e18
    assert (
        pytest.approx(inflation_manager.getKeeperRateForPool(pool))
        == minter.getKeeperInflationRate()
    )


def test_set_keeper_pool_weight_two_pools(
    admin, inflation_manager, chain, pool, cappedPool, lpToken, cappedLpToken
):
    assert inflation_manager.getKeeperWeightForPool(pool) == 0
    assert inflation_manager.getKeeperWeightForPool(cappedPool) == 0
    assert inflation_manager.totalKeeperPoolWeight() == 0
    inflation_manager.prepareKeeperPoolWeight(pool, 0.3 * 1e18, {"from": admin})
    inflation_manager.prepareKeeperPoolWeight(cappedPool, 0.4 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeKeeperPoolWeight(pool)
    inflation_manager.executeKeeperPoolWeight(cappedPool)
    assert inflation_manager.totalKeeperPoolWeight() == 0.7 * 1e18
    assert inflation_manager.getKeeperWeightForPool(pool) == 0.3 * 1e18
    assert inflation_manager.getKeeperWeightForPool(cappedPool) == 0.4 * 1e18


def test_set_keeper_pool_weight_two_pools_larger_one(
    admin, inflation_manager, chain, minter, pool, cappedPool
):
    assert inflation_manager.getKeeperWeightForPool(pool) == 0
    assert inflation_manager.getKeeperWeightForPool(cappedPool) == 0
    assert inflation_manager.totalKeeperPoolWeight() == 0
    inflation_manager.prepareKeeperPoolWeight(pool, 3 * 1e18, {"from": admin})
    inflation_manager.prepareKeeperPoolWeight(cappedPool, 2 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeKeeperPoolWeight(pool)
    inflation_manager.executeKeeperPoolWeight(cappedPool)
    assert inflation_manager.totalKeeperPoolWeight() == 5 * 1e18
    assert inflation_manager.getKeeperWeightForPool(pool) == 3 * 1e18
    assert inflation_manager.getKeeperWeightForPool(cappedPool) == 2 * 1e18
    keeper_inflation = minter.getKeeperInflationRate()

    assert (
        pytest.approx(inflation_manager.getKeeperRateForPool(pool))
        == keeper_inflation * 0.6
    )
    assert (
        pytest.approx(inflation_manager.getKeeperRateForPool(cappedPool))
        == keeper_inflation * 0.4
    )


def test_set_lp_pool_weight(
    admin, inflation_manager, chain, lpToken, stakerVault, minter, lpGauge
):
    assert inflation_manager.getLpPoolWeight(lpToken) == 0
    assert inflation_manager.totalLpPoolWeight() == 0
    inflation_manager.prepareLpPoolWeight(lpToken, 0.3 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeLpPoolWeight(lpToken)
    assert inflation_manager.totalLpPoolWeight() == 0.3 * 1e18
    assert inflation_manager.getLpPoolWeight(lpToken) == 0.3 * 1e18
    assert (
        pytest.approx(inflation_manager.getLpRateForStakerVault(stakerVault))
        == minter.getLpInflationRate()
    )


def test_set_lp_pool_weight_larger_one(
    admin, inflation_manager, chain, lpToken, stakerVault, minter, lpGauge
):
    assert inflation_manager.getLpPoolWeight(lpToken) == 0
    assert inflation_manager.totalLpPoolWeight() == 0
    inflation_manager.prepareLpPoolWeight(lpToken, 2 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeLpPoolWeight(lpToken)
    assert inflation_manager.totalLpPoolWeight() == 2 * 1e18
    assert (
        pytest.approx(inflation_manager.getLpRateForStakerVault(stakerVault))
        == minter.getLpInflationRate()
    )


def test_set_lp_pool_weight_two_pools_larger_one(
    admin,
    controller,
    inflation_manager,
    chain,
    lpToken,
    stakerVault,
    LpToken,
    StakerVault,
    minter,
    lpGauge,
    LpGauge,
    cappedLpToken,
    cappedStakerVault,
):
    otherLpGauge = admin.deploy(LpGauge, controller, cappedStakerVault)
    cappedStakerVault.initializeLpGauge(otherLpGauge, {"from": admin})

    assert inflation_manager.getLpPoolWeight(lpToken) == 0
    assert inflation_manager.getLpPoolWeight(cappedLpToken) == 0
    assert inflation_manager.totalLpPoolWeight() == 0
    inflation_manager.prepareLpPoolWeight(lpToken, 3 * 1e18, {"from": admin})
    inflation_manager.prepareLpPoolWeight(cappedLpToken, 3 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeLpPoolWeight(lpToken)
    inflation_manager.executeLpPoolWeight(cappedLpToken)
    assert inflation_manager.totalLpPoolWeight() == 6 * 1e18
    target_inflation = 0.5 * minter.getLpInflationRate()

    assert (
        pytest.approx(inflation_manager.getLpRateForStakerVault(stakerVault))
        == target_inflation
    )
    assert (
        pytest.approx(inflation_manager.getLpRateForStakerVault(stakerVault))
        == target_inflation
    )


def test_set_lp_pool_weights_batch_two_pools_larger_one(
    admin,
    controller,
    inflation_manager,
    chain,
    lpToken,
    stakerVault,
    minter,
    lpGauge,
    LpGauge,
    cappedLpToken,
    cappedStakerVault,
):
    otherLpGauge = admin.deploy(LpGauge, controller, cappedStakerVault)
    cappedStakerVault.initializeLpGauge(otherLpGauge, {"from": admin})

    assert inflation_manager.getLpPoolWeight(lpToken) == 0
    assert inflation_manager.getLpPoolWeight(cappedLpToken) == 0
    assert inflation_manager.totalLpPoolWeight() == 0
    inflation_manager.batchPrepareLpPoolWeights(
        [lpToken, cappedLpToken],
        [3 * 1e18, 3 * 1e18],
        {"from": admin},
    )
    chain.sleep(ADMIN_DELAY)
    inflation_manager.batchExecuteLpPoolWeights([lpToken, cappedLpToken])
    assert inflation_manager.totalLpPoolWeight() == 6 * 1e18
    target_inflation = 0.5 * minter.getLpInflationRate()

    assert (
        pytest.approx(inflation_manager.getLpRateForStakerVault(stakerVault))
        == target_inflation
    )
    assert (
        pytest.approx(inflation_manager.getLpRateForStakerVault(cappedStakerVault))
        == target_inflation
    )


def test_set_keeper_pool_weights_batch_two_pools_larger_one(
    admin, inflation_manager, chain, minter, pool, cappedPool
):
    assert inflation_manager.getKeeperWeightForPool(pool) == 0
    assert inflation_manager.getKeeperWeightForPool(cappedPool) == 0
    assert inflation_manager.totalKeeperPoolWeight() == 0
    inflation_manager.batchPrepareKeeperPoolWeights(
        [pool, cappedPool], [3 * 1e18, 2 * 1e18], {"from": admin}
    )
    chain.sleep(ADMIN_DELAY)
    inflation_manager.batchExecuteKeeperPoolWeights([pool, cappedPool])
    assert inflation_manager.totalKeeperPoolWeight() == 5 * 1e18
    assert inflation_manager.getKeeperWeightForPool(pool) == 3 * 1e18
    assert inflation_manager.getKeeperWeightForPool(cappedPool) == 2 * 1e18
    keeper_inflation = minter.getKeeperInflationRate()

    assert (
        pytest.approx(inflation_manager.getKeeperRateForPool(pool))
        == keeper_inflation * 0.6
    )
    assert (
        pytest.approx(inflation_manager.getKeeperRateForPool(cappedPool))
        == keeper_inflation * 0.4
    )


def test_batch_set_amm_token_weights_two_pools_larger_one(
    admin,
    inflation_manager,
    chain,
    minter,
    otherMockAmmGauge,
    mockAmmGauge,
    alice,
    bob,
    mockAmmToken,
):
    inflation_manager.setAmmGauge(mockAmmToken, mockAmmGauge, {"from": admin})
    inflation_manager.setAmmGauge(bob, otherMockAmmGauge, {"from": admin})
    inflation_manager.batchPrepareAmmTokenWeights(
        [bob, mockAmmToken], [2 * 1e18, 2 * 1e18], {"from": admin}
    )
    chain.sleep(ADMIN_DELAY)
    inflation_manager.batchExecuteAmmTokenWeights([bob, mockAmmToken], {"from": admin})
    assert inflation_manager.getAmmWeightForToken(bob) == 2 * 1e18
    assert inflation_manager.getAmmWeightForToken(mockAmmToken) == 2 * 1e18
    assert inflation_manager.totalAmmTokenWeight() == 4 * 1e18
    amm_inflation = minter.getAmmInflationRate()
    assert (
        pytest.approx(inflation_manager.getAmmRateForToken(bob)) == 0.5 * amm_inflation
    )
    assert (
        pytest.approx(inflation_manager.getAmmRateForToken(mockAmmToken))
        == 0.5 * amm_inflation
    )


def test_set_lp_pool_weights_batch_two_pools_larger_one_governance_proxy(
    admin,
    controller,
    inflation_manager,
    lpToken,
    stakerVault,
    minter,
    bob,
    lpGauge,
    LpGauge,
    cappedStakerVault,
    cappedLpToken,
    role_manager,
):
    otherLpGauge = admin.deploy(LpGauge, controller, cappedStakerVault)
    cappedStakerVault.initializeLpGauge(otherLpGauge, {"from": admin})

    role_manager.addGovernor(bob, {"from": admin})
    role_manager.grantRole(Roles.INFLATION_MANAGER.value, bob, {"from": admin})

    assert inflation_manager.getLpPoolWeight(lpToken) == 0
    assert inflation_manager.getLpPoolWeight(cappedLpToken) == 0
    assert inflation_manager.totalLpPoolWeight() == 0
    inflation_manager.batchPrepareLpPoolWeights(
        [lpToken, cappedLpToken],
        [3 * 1e18, 3 * 1e18],
        {"from": bob},
    )
    with reverts(""):
        inflation_manager.batchExecuteLpPoolWeights(
            [lpToken, cappedLpToken], {"from": admin}
        )

    inflation_manager.batchExecuteLpPoolWeights([lpToken, cappedLpToken], {"from": bob})
    assert inflation_manager.totalLpPoolWeight() == 6 * 1e18
    target_inflation = 0.5 * minter.getLpInflationRate()

    assert (
        pytest.approx(inflation_manager.getLpRateForStakerVault(stakerVault))
        == target_inflation
    )
    assert (
        pytest.approx(inflation_manager.getLpRateForStakerVault(stakerVault))
        == target_inflation
    )


def test_set_keeper_pool_weights_batch_two_pools_larger_one_governance_proxy(
    admin, inflation_manager, chain, minter, bob, pool, cappedPool, role_manager
):

    role_manager.addGovernor(bob, {"from": admin})
    role_manager.grantRole(Roles.INFLATION_MANAGER.value, bob, {"from": admin})
    assert inflation_manager.getKeeperWeightForPool(pool) == 0
    assert inflation_manager.getKeeperWeightForPool(cappedPool) == 0
    assert inflation_manager.totalKeeperPoolWeight() == 0
    inflation_manager.batchPrepareKeeperPoolWeights(
        [pool, cappedPool], [3 * 1e18, 2 * 1e18], {"from": admin}
    )
    with reverts(""):
        inflation_manager.batchExecuteKeeperPoolWeights([pool, cappedPool])

    inflation_manager.batchExecuteKeeperPoolWeights([pool, cappedPool], {"from": bob})
    assert inflation_manager.totalKeeperPoolWeight() == 5 * 1e18
    assert inflation_manager.getKeeperWeightForPool(pool) == 3 * 1e18
    assert inflation_manager.getKeeperWeightForPool(cappedPool) == 2 * 1e18
    keeper_inflation = minter.getKeeperInflationRate()

    assert (
        pytest.approx(inflation_manager.getKeeperRateForPool(pool))
        == keeper_inflation * 0.6
    )
    assert (
        pytest.approx(inflation_manager.getKeeperRateForPool(cappedPool))
        == keeper_inflation * 0.4
    )


def test_batch_set_amm_token_weights_two_pools_larger_one_governance_proxy(
    admin,
    inflation_manager,
    chain,
    minter,
    otherMockAmmGauge,
    mockAmmGauge,
    alice,
    bob,
    mockAmmToken,
    role_manager,
):

    role_manager.addGovernor(bob, {"from": admin})
    role_manager.grantRole(Roles.INFLATION_MANAGER.value, bob, {"from": admin})
    inflation_manager.setAmmGauge(mockAmmToken, mockAmmGauge, {"from": admin})
    inflation_manager.setAmmGauge(bob, otherMockAmmGauge, {"from": admin})
    inflation_manager.batchPrepareAmmTokenWeights(
        [bob, mockAmmToken], [2 * 1e18, 2 * 1e18], {"from": admin}
    )

    with reverts(""):
        inflation_manager.batchExecuteAmmTokenWeights(
            [bob, mockAmmToken], {"from": admin}
        )

    inflation_manager.batchExecuteAmmTokenWeights([bob, mockAmmToken], {"from": bob})
    assert inflation_manager.getAmmWeightForToken(bob) == 2 * 1e18
    assert inflation_manager.getAmmWeightForToken(mockAmmToken) == 2 * 1e18
    assert inflation_manager.totalAmmTokenWeight() == 4 * 1e18
    amm_inflation = minter.getAmmInflationRate()
    assert (
        pytest.approx(inflation_manager.getAmmRateForToken(bob)) == 0.5 * amm_inflation
    )
    assert (
        pytest.approx(inflation_manager.getAmmRateForToken(mockAmmToken))
        == 0.5 * amm_inflation
    )
