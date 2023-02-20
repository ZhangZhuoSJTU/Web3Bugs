from brownie import StrategySwapper, AddressProvider  # type: ignore
from support.mainnet_contracts import TokenAddresses, VendorAddresses
from support.utils import scale


from support.utils import (
    get_deployer,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)


@with_gas_usage
@with_deployed(AddressProvider)
def deploy_strategy_swapper(address_provider):
    tx_params = make_tx_params()
    deployer = get_deployer()

    ## Deploying strategy swapper
    strategy_swapper = deployer.deploy(
        StrategySwapper,
        address_provider,
        scale("0.97"),
        **tx_params,
    )

    ## Setting curve pools
    strategy_swapper.setCurvePool(TokenAddresses.CRV, VendorAddresses.CURVE_CRV_ETH_POOL, {"from": deployer, **tx_params})
    strategy_swapper.setCurvePool(TokenAddresses.CVX, VendorAddresses.CURVE_CVX_ETH_POOL, {"from": deployer, **tx_params})

    return strategy_swapper


def main():
    deploy_strategy_swapper()
