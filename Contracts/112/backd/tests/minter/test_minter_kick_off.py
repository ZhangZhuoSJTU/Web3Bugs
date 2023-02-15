import pytest

from support.constants import ADMIN_DELAY


def test_minter_kickoff(
    minter,
    controller,
    inflation_manager,
    address_provider,
    admin,
    pool,
    bob,
    stakerVault,
    mockKeeperGauge,
    mockAmmGauge,
    chain,
    lpToken,
    lpGauge,
    mockAmmToken,
):
    # Check that all the inflation rates are 0
    assert inflation_manager.getKeeperRateForPool(pool) == 0
    assert inflation_manager.getAmmRateForToken(bob) == 0
    assert inflation_manager.getLpRateForStakerVault(stakerVault) == 0

    # Set the minter and add all the
    inflation_manager.setMinter(minter, {"from": admin})
    inflation_manager.setKeeperGauge(pool, mockKeeperGauge, {"from": admin})
    inflation_manager.setAmmGauge(mockAmmToken, mockAmmGauge, {"from": admin})
    address_provider.addPool(pool, {"from": admin})

    # Set all the weights for the Gauges and stakerVault
    inflation_manager.prepareLpPoolWeight(lpToken, 0.4 * 1e18, {"from": admin})
    inflation_manager.prepareKeeperPoolWeight(pool, 0.4 * 1e18, {"from": admin})
    inflation_manager.prepareAmmTokenWeight(mockAmmToken, 0.4 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeLpPoolWeight(lpToken, {"from": admin})
    inflation_manager.executeKeeperPoolWeight(pool, {"from": admin})
    inflation_manager.executeAmmTokenWeight(mockAmmToken, {"from": admin})

    assert (
        inflation_manager.getKeeperRateForPool(pool) == minter.getKeeperInflationRate()
    )
    assert (
        inflation_manager.getAmmRateForToken(mockAmmToken)
        == minter.getAmmInflationRate()
    )
    assert (
        inflation_manager.getLpRateForStakerVault(stakerVault)
        == minter.getLpInflationRate()
    )
