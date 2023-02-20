from brownie import RoleManager, AddressProvider  # type: ignore

from support.utils import (
    get_deployer,
    as_singleton,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)


@with_gas_usage
@as_singleton(RoleManager)
@with_deployed(AddressProvider)
def main(address_provider):
    deployer = get_deployer()
    role_manager = deployer.deploy(RoleManager, address_provider, **make_tx_params())
    address_provider.initialize(role_manager, {"from": deployer, **make_tx_params()})
