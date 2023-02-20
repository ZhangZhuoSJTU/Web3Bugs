import brownie
import pytest


ADMIN_DELAY = 3 * 86400


@pytest.fixture(scope="module")
def otherMockAmmToken(MockAmmToken, admin):
    return admin.deploy(MockAmmToken, "MockAmmOther", "MockAmmOther")


@pytest.fixture
def otherMockAmmGauge(admin, MockAmmGauge, controller, otherMockAmmToken):
    return admin.deploy(MockAmmGauge, controller, otherMockAmmToken)


@pytest.fixture
def otherMockKeeperGauge(admin, MockKeeperGauge, controller, pool):
    return admin.deploy(MockKeeperGauge, controller, pool)


@pytest.fixture
def inflation_kickoff(
    minter,
    controller,
    inflation_manager,
    address_provider,
    admin,
    pool,
    bob,
    mockKeeperGauge,
    mockAmmGauge,
    chain,
    lpToken,
    lpGauge,
    mockAmmToken,
):
    # Set the minter and add all the
    inflation_manager.setMinter(minter, {"from": admin})
    inflation_manager.setKeeperGauge(pool, mockKeeperGauge)
    inflation_manager.setAmmGauge(mockAmmToken, mockAmmGauge)
    address_provider.addPool(pool, {"from": admin})

    # Set all the weights for the Gauges and stakerVault
    inflation_manager.prepareLpPoolWeight(lpToken, 0.4 * 1e18, {"from": admin})
    inflation_manager.prepareKeeperPoolWeight(pool, 0.4 * 1e18, {"from": admin})
    inflation_manager.prepareAmmTokenWeight(mockAmmToken, 0.4 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeLpPoolWeight(lpToken, {"from": admin})
    inflation_manager.executeKeeperPoolWeight(pool, {"from": admin})
    inflation_manager.executeAmmTokenWeight(mockAmmToken, {"from": admin})


@pytest.mark.usefixtures("inflation_kickoff")
def test_change_amm_gauge_after_inflation(
    inflation_manager,
    admin,
    address_provider,
    mockAmmGauge,
    otherMockAmmGauge,
    mockAmmToken,
    MockAmmGauge,
    controller,
    chain,
):
    inflation_manager.removeAmmGauge(mockAmmToken, {"from": admin})
    assert inflation_manager.getAmmRateForToken(mockAmmToken) == 0
    otherMockAmmGauge = admin.deploy(MockAmmGauge, controller, mockAmmToken)
    inflation_manager.setAmmGauge(mockAmmToken, otherMockAmmGauge, {"from": admin})
    assert inflation_manager.getAmmRateForToken(mockAmmToken) == 0

    inflation_manager.prepareAmmTokenWeight(mockAmmToken, 0.4 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeAmmTokenWeight(mockAmmToken, {"from": admin})
