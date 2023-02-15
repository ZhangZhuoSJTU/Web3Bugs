from brownie import VaultReserve, AddressProvider, RoleManager  # type: ignore
from support.constants import AddressProviderKeys

from support.utils import (
    get_deployer,
    as_singleton,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)


@with_gas_usage
@as_singleton(VaultReserve)
@with_deployed(RoleManager)
@with_deployed(AddressProvider)
def main(address_provider, role_manager):
    deployer = get_deployer()
    vault_reserve = deployer.deploy(VaultReserve, role_manager, **make_tx_params())
    address_provider.initializeAddress(
        AddressProviderKeys.VAULT_RESERVE.value,
        vault_reserve,
        {"from": deployer, **make_tx_params()},
    )
