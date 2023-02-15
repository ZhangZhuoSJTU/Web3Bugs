from brownie import GasBank, AddressProvider, Controller
from support.constants import AddressProviderKeys  # type: ignore

from support.utils import (
    get_deployer,
    as_singleton,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)


@with_gas_usage
@as_singleton(GasBank)
@with_deployed(AddressProvider)
@with_deployed(Controller)
def main(controller, address_provider):
    deployer = get_deployer()
    gas_bank = deployer.deploy(GasBank, controller, **make_tx_params())  # type: ignore
    address_provider.initializeAddress(
        AddressProviderKeys.GAS_BANK.value,
        gas_bank,
        {"from": deployer, **make_tx_params()},
    )
