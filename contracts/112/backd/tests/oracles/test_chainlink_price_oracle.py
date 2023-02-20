import time

import brownie
import pytest
from support.mainnet_contracts import ChainlinkFeeds, TokenAddresses
from support.utils import scale


@pytest.fixture(scope="module")
def chainlink_price_oracle(ChainlinkOracleProvider, role_manager, admin):
    contract = admin.deploy(
        ChainlinkOracleProvider, role_manager, ChainlinkFeeds.ETH_USD_FEED
    )
    contract.setStalePriceDelay(100 * 86400, {"from": admin})
    return contract


@pytest.fixture(scope="module")
def set_common_feeds(admin, chainlink_price_oracle):
    feeds = [
        (TokenAddresses.DAI, ChainlinkFeeds.DAI_USD_FEED),
        (TokenAddresses.WBTC, ChainlinkFeeds.WBTC_USD_FEED),
        (TokenAddresses.CRV, ChainlinkFeeds.CRV_USD_FEED),
    ]
    for asset, feed in feeds:
        chainlink_price_oracle.setFeed(asset, feed, {"from": admin})


def test_set_feed(admin, chainlink_price_oracle):
    assert (
        chainlink_price_oracle.feeds(TokenAddresses.ETH) == ChainlinkFeeds.ETH_USD_FEED
    )
    chainlink_price_oracle.setFeed(
        TokenAddresses.ETH, ChainlinkFeeds.CRV_USD_FEED, {"from": admin}
    )
    assert (
        chainlink_price_oracle.feeds(TokenAddresses.ETH) == ChainlinkFeeds.CRV_USD_FEED
    )


def test_fails_non_existent_asset(chainlink_price_oracle):
    with brownie.reverts("Asset not supported"):  # type: ignore
        chainlink_price_oracle.getPriceUSD(TokenAddresses.CVX)


def test_fails_negative_price(admin, chainlink_price_oracle, MockChainlinkFeed):
    feed = admin.deploy(MockChainlinkFeed, 8, -1, int(time.time()))
    chainlink_price_oracle.setFeed(TokenAddresses.ETH, feed, {"from": admin})
    with brownie.reverts("Price is negative"):  # type: ignore
        chainlink_price_oracle.getPriceUSD(TokenAddresses.ETH)


def test_set_stale_price_delay(chainlink_price_oracle, admin):
    chainlink_price_oracle.setStalePriceDelay(172800, {"from": admin})
    assert chainlink_price_oracle.stalePriceDelay() == 172800


def test_fails_stale_price(admin, chainlink_price_oracle, MockChainlinkFeed):
    chainlink_price_oracle.setStalePriceDelay(7200, {"from": admin})
    feed = admin.deploy(
        MockChainlinkFeed, 8, scale(2500, 8), int(time.time()) - 100_000
    )
    chainlink_price_oracle.setFeed(TokenAddresses.ETH, feed, {"from": admin})
    with brownie.reverts("Price is stale"):  # type: ignore
        chainlink_price_oracle.getPriceUSD(TokenAddresses.ETH)


def test_get_price_same_scale(admin, chainlink_price_oracle, MockChainlinkFeed):
    feed = admin.deploy(MockChainlinkFeed, 18, scale(2500, 18), int(time.time()))
    chainlink_price_oracle.setFeed(TokenAddresses.ETH, feed, {"from": admin})
    assert chainlink_price_oracle.getPriceUSD(TokenAddresses.ETH) == scale(2500, 18)


def test_get_price_lower_scale(admin, chainlink_price_oracle, MockChainlinkFeed):
    feed = admin.deploy(MockChainlinkFeed, 8, scale(2500, 8), int(time.time()))
    chainlink_price_oracle.setFeed(TokenAddresses.ETH, feed, {"from": admin})
    assert chainlink_price_oracle.getPriceUSD(TokenAddresses.ETH) == scale(2500, 18)


def test_get_price_higher_scale(admin, chainlink_price_oracle, MockChainlinkFeed):
    feed = admin.deploy(MockChainlinkFeed, 27, scale(2500, 27), int(time.time()))
    chainlink_price_oracle.setFeed(TokenAddresses.ETH, feed, {"from": admin})
    assert chainlink_price_oracle.getPriceUSD(TokenAddresses.ETH) == scale(2500, 18)


@pytest.mark.mainnetFork
@pytest.mark.usefixtures("set_common_feeds")
def test_mainnet_usd_feeds(chainlink_price_oracle):
    eth_price = chainlink_price_oracle.getPriceUSD(TokenAddresses.ETH)
    assert scale(1000) <= eth_price <= scale(5000)

    btc_price = chainlink_price_oracle.getPriceUSD(TokenAddresses.WBTC)
    assert scale(20_000) <= btc_price <= scale(100_000)

    dai_price = chainlink_price_oracle.getPriceUSD(TokenAddresses.DAI)
    assert scale("0.95") <= dai_price <= scale("1.05")


@pytest.mark.mainnetFork
@pytest.mark.usefixtures("set_common_feeds")
def test_mainnet_eth_feeds(chainlink_price_oracle):
    btc_price = chainlink_price_oracle.getPriceETH(TokenAddresses.WBTC)
    assert scale(10) <= btc_price <= scale(20)

    dai_price = chainlink_price_oracle.getPriceETH(TokenAddresses.DAI)
    assert scale("0.00005") <= dai_price <= scale("0.0009")

    crv_price = chainlink_price_oracle.getPriceETH(TokenAddresses.CRV)
    assert scale("0.00012") <= crv_price <= scale("0.012")
