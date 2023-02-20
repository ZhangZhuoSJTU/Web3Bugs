import brownie
import pytest
from support.mainnet_contracts import TokenAddresses, VendorAddresses
from support.utils import scale


@pytest.fixture(scope="module")
def chainlink_price_oracle(ChainlinkOracleProvider, role_manager, admin):
    contract = admin.deploy(
        ChainlinkOracleProvider, role_manager, VendorAddresses.CHAINLINK_FEED_REGISTRY
    )
    contract.setStalePriceDelay(100 * 86400, {"from": admin})
    return contract


def test_set_stale_price_delay(chainlink_price_oracle, admin):
    chainlink_price_oracle.setStalePriceDelay(172800, {"from": admin})
    assert chainlink_price_oracle.stalePriceDelay() == 172800


@pytest.mark.mainnetFork
def test_mainnet_usd_feeds(chainlink_price_oracle):
    sushi_price = chainlink_price_oracle.getPriceUSD(TokenAddresses.SUSHI)
    assert scale("0.5") <= sushi_price <= scale(10)

    dai_price = chainlink_price_oracle.getPriceUSD(TokenAddresses.DAI)
    assert scale("0.95") <= dai_price <= scale("1.05")


@pytest.mark.mainnetFork
def test_mainnet_eth_feeds(chainlink_price_oracle):
    sushi_price = chainlink_price_oracle.getPriceETH(TokenAddresses.SUSHI)
    assert scale("0.000087592") <= sushi_price <= scale("0.0087592")

    dai_price = chainlink_price_oracle.getPriceETH(TokenAddresses.DAI)
    assert scale("0.00005") <= dai_price <= scale("0.0009")

    crv_price = chainlink_price_oracle.getPriceETH(TokenAddresses.CRV)
    assert scale("0.00012") <= crv_price <= scale("0.012")
