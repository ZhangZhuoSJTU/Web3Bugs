import brownie
import pytest


ADMIN_DELAY = 3 * 86400


@pytest.fixture
def inflation_kickoff(
    minter,
    inflation_manager,
    address_provider,
    admin,
    pool,
    mockKeeperGauge,
    mockAmmGauge,
    chain,
    lpToken,
    mockAmmToken,
    lpGauge,
    topUpActionFeeHandler,
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

    topUpActionFeeHandler.setInitialKeeperGaugeForToken(
        lpToken, mockKeeperGauge, {"from": admin}
    )
