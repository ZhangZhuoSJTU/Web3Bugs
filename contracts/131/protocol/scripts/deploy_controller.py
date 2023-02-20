from brownie import Controller, AddressProvider
from support.constants import AddressProviderKeys  # type: ignore

from support.utils import (
    get_deployer,
    as_singleton,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)


@with_gas_usage
@as_singleton(Controller)
@with_deployed(AddressProvider)
def main(address_provider):
    deployer = get_deployer()
    controller = deployer.deploy(
        Controller, address_provider, **make_tx_params()  # type: ignore
    )

    address_provider.initializeAddress(
        AddressProviderKeys.CONTROLLER.value,
        controller,
        {"from": deployer, **make_tx_params()},
    )
