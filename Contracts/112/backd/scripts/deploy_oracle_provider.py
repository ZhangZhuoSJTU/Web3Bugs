from brownie import ChainlinkOracleProvider, RoleManager, AddressProvider
from support.constants import AddressProviderKeys
from support.mainnet_contracts import ChainlinkFeeds, TokenAddresses

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
        ChainlinkOracleProvider, role_manager, ChainlinkFeeds.ETH_USD_FEED, **make_tx_params()  # type: ignore
    )
    feeds = [
        (TokenAddresses.DAI, ChainlinkFeeds.DAI_USD_FEED),
        (TokenAddresses.USDC, ChainlinkFeeds.USDC_USD_FEED),
        (TokenAddresses.USDT, ChainlinkFeeds.USDT_USD_FEED),
        (TokenAddresses.SETH, ChainlinkFeeds.SETH_USD_FEED),
        (TokenAddresses.CRV, ChainlinkFeeds.CRV_USD_FEED),
        (TokenAddresses.WETH, ChainlinkFeeds.WETH_USD_FEED),
        (TokenAddresses.CVX, ChainlinkFeeds.CVX_USD_FEED),
        (TokenAddresses.UNI, ChainlinkFeeds.UNI_USD_FEED),
        (TokenAddresses.SUSHI, ChainlinkFeeds.SUSHI_USD_FEED),
        (TokenAddresses.WBTC, ChainlinkFeeds.WBTC_USD_FEED),
        (TokenAddresses.SPELL, ChainlinkFeeds.SPELL_USD_FEED),
    ]
    for asset, feed in feeds:
        oracleProvider.setFeed(asset, feed, {"from": deployer, **make_tx_params()})

    address_provider.initializeAddress(
        AddressProviderKeys.ORACLE_PROVIDER.value,
        oracleProvider,
        {"from": deployer, **make_tx_params()},
    )
