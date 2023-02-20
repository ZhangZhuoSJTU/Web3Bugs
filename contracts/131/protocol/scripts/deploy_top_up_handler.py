from support.utils import (
    get_addresses,
    get_deployer,
    as_singleton,
    is_live,
    make_tx_params,
    with_gas_usage,
)
from brownie import AaveHandler, CompoundHandler, MockTopUpHandler, CTokenRegistry  # type: ignore


@as_singleton(MockTopUpHandler)
def deploy_mock_handler():
    return get_deployer().deploy(MockTopUpHandler, **make_tx_params())


@with_gas_usage
def _deploy_handler(Handler, name, *args):
    print(f"deploying {name} handler")
    if is_live():
        get_deployer().deploy(Handler, *args, **make_tx_params())
    else:
        deploy_mock_handler()


@as_singleton(AaveHandler)
def aave():
    addresses = get_addresses()
    _deploy_handler(AaveHandler, "Aave", addresses.aave_lending_pool, addresses.weth)


@as_singleton(CompoundHandler)
def compound():
    addresses = get_addresses()
    args = [addresses.comptroller]
    if is_live():
        ctoken_registry = get_deployer().deploy(
            CTokenRegistry, addresses.comptroller, **make_tx_params()  # type: ignore
        )
        args.append(ctoken_registry)
    _deploy_handler(CompoundHandler, "Compound", *args)
