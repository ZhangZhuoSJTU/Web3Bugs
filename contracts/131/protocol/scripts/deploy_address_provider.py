from brownie import AddressProvider  # type: ignore

from support.utils import (
    get_deployer,
    as_singleton,
    get_treasury,
    make_tx_params,
    with_gas_usage,
)


@with_gas_usage
@as_singleton(AddressProvider)
def main():
    treasury = get_treasury()
    get_deployer().deploy(AddressProvider, treasury, **make_tx_params())
