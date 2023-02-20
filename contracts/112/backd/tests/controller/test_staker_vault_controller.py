import brownie
import pytest


ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


def add_staker_vault(
    admin, alice, StakerVault, mockToken, controller, address_provider
):
    secondVault = admin.deploy(StakerVault, controller)
    secondVault.initialize(mockToken, {"from": admin})
    with brownie.reverts("unauthorized access"):
        controller.addStakerVault(secondVault, {"from": alice})

    controller.addStakerVault(secondVault, {"from": admin})
    assert address_provider.isStakerVaultRegistered(secondVault)
    token = secondVault.token()
    assert secondVault == address_provider.getStakerVault(token)
    return secondVault


def test_add_staker_vault(
    admin, alice, StakerVault, mockToken, controller, address_provider
):
    add_staker_vault(admin, alice, StakerVault, mockToken, controller, address_provider)


@pytest.mark.usefixtures("inflation_kickoff")
def test_add_staker_vault_with_inflation(
    admin,
    alice,
    StakerVault,
    mockToken,
    controller,
    address_provider,
    inflation_manager,
    LpGauge,
):
    secondVault = add_staker_vault(
        admin, alice, StakerVault, mockToken, controller, address_provider
    )
    assert inflation_manager.getLpRateForStakerVault(secondVault) == 0
    gauge = admin.deploy(LpGauge, controller, secondVault)
    secondVault.initializeLpGauge(gauge, {"from": admin})
    assert inflation_manager.gauges(gauge)


def test_add_staker_vault_fail(admin, controller, stakerVault, lpToken, StakerVault):
    # token already registered
    secondVault = admin.deploy(StakerVault, controller)
    secondVault.initialize(lpToken, {"from": admin})
    assert lpToken == secondVault.getToken()
    assert lpToken == stakerVault.getToken()
    with brownie.reverts("a staker vault already exists for the token"):
        controller.addStakerVault(secondVault, {"from": admin})


def test_is_whitelisted_vault(
    admin, alice, mockToken, StakerVault, controller, stakerVault, address_provider
):
    assert address_provider.isStakerVaultRegistered(stakerVault, {"from": alice})
    secondVault = admin.deploy(StakerVault, controller)
    secondVault.initialize(mockToken, {"from": admin})
    assert not address_provider.isStakerVaultRegistered(secondVault)
    controller.addStakerVault(secondVault, {"from": admin})
    assert address_provider.isStakerVaultRegistered(secondVault)
