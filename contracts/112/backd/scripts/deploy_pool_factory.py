from brownie import PoolFactory, Controller, AddressProvider  # type: ignore
from support.constants import AddressProviderKeys

from support.utils import (
    get_deployer,
    as_singleton,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)


@with_gas_usage
@as_singleton(PoolFactory)
@with_deployed(AddressProvider)
@with_deployed(Controller)
def deploy_pool_factory(controller, address_provider):
    print("deploying pool factory")
    tx_params = make_tx_params()
    deployer = get_deployer()
    pool_factory = deployer.deploy(PoolFactory, controller, **tx_params)
    address_provider.initializeAddress(
        AddressProviderKeys.POOL_FACTORY.value,
        pool_factory,
        {"from": deployer, **make_tx_params()},
    )
    return pool_factory.address


def main():
    deploy_pool_factory()
