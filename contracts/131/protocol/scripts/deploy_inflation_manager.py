from brownie import Controller, AddressProvider, InflationManager, Minter  # type: ignore

from support.utils import (
    get_deployer,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)


@with_gas_usage
@with_deployed(AddressProvider)
@with_deployed(Controller)
@with_deployed(Minter)
def main(minter, controller, address_provider):
    deployer = get_deployer()
    inflation_manager = deployer.deploy(
        InflationManager, address_provider, **make_tx_params()  # type: ignore
    )
    inflation_manager.setMinter(minter, {"from": deployer, **make_tx_params()})
    controller.setInflationManager(
        inflation_manager, {"from": deployer, **make_tx_params()}
    )
    return inflation_manager
