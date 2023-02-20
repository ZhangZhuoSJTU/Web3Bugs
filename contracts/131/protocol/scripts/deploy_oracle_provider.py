from brownie import ChainlinkOracleProvider, RoleManager, AddressProvider
from support.constants import AddressProviderKeys
from support.mainnet_contracts import VendorAddresses

from support.utils import (
    get_deployer,
    as_singleton,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)


@with_gas_usage
@as_singleton(ChainlinkOracleProvider)
@with_deployed(RoleManager)
@with_deployed(AddressProvider)
def main(address_provider, role_manager):
    deployer = get_deployer()
    oracleProvider = deployer.deploy(
        ChainlinkOracleProvider, role_manager, VendorAddresses.CHAINLINK_FEED_REGISTRY, **make_tx_params()  # type: ignore
    )
    address_provider.initializeAddress(
        AddressProviderKeys.ORACLE_PROVIDER.value,
        oracleProvider,
        {"from": deployer, **make_tx_params()},
    )
