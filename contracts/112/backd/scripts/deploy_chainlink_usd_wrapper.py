from brownie import ChainlinkUsdWrapper

from support.utils import (
    get_deployer,
    as_singleton,
    make_tx_params,
    with_gas_usage,
)


@with_gas_usage
@as_singleton(ChainlinkUsdWrapper)
def deploy_chainlink_usd_wrapper():
    print("Deploying Chainlink USD Wrapper")
    ldo_eth_oracle = "0x4e844125952d32acdf339be976c98e22f6f318db"
    pool_factory = get_deployer().deploy(ChainlinkUsdWrapper, ldo_eth_oracle, **make_tx_params())
    return pool_factory.address


def main():
    deploy_chainlink_usd_wrapper()
