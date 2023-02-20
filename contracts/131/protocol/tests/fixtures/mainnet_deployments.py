import json
import pytest
from brownie import ZERO_ADDRESS
from support.mainnet_contracts import TokenAddresses
from brownie import interface, ZERO_ADDRESS


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_deployments():
    with open("./config/deployments/map.json") as map:
        return json.load(map)


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_controller(mainnet_deployments):
    controller_address = mainnet_deployments["1"]["Controller"][0]
    return interface.IController(controller_address)


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_address_provider(mainnet_controller):
    return interface.IAddressProvider(mainnet_controller.addressProvider())


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_chainlink_oracle_provider(mainnet_deployments):
    oracle_provider_address = mainnet_deployments["1"]["ChainlinkOracleProvider"][0]
    return interface.IChainlinkOracleProvider(oracle_provider_address)


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_oracle_provider(mainnet_pools):
    for pool_address in mainnet_pools:
        pool = interface.ILiquidityPool(pool_address)
        if pool.getUnderlying() == ZERO_ADDRESS:
            return pool


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_pools(mainnet_address_provider):
    return mainnet_address_provider.allPools()


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_usdc_pool(mainnet_pools):
    for pool_address in mainnet_pools:
        pool = interface.ILiquidityPool(pool_address)
        if pool.getUnderlying() == TokenAddresses.USDC:
            return pool


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_usdc_vault(mainnet_usdc_pool):
    return interface.IVault(mainnet_usdc_pool.getVault())


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_usdc_strategy(mainnet_usdc_vault):
    return interface.IStrategy(mainnet_usdc_vault.getStrategy())


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_eth_pool(mainnet_pools):
    for pool_address in mainnet_pools:
        pool = interface.ILiquidityPool(pool_address)
        if pool.getUnderlying() == ZERO_ADDRESS:
            return pool


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_eth_vault(mainnet_eth_pool):
    return interface.IVault(mainnet_eth_pool.getVault())


@pytest.fixture
@pytest.mark.mainnetFork
def mainnet_eth_strategy(mainnet_eth_vault):
    return interface.IStrategy(mainnet_eth_vault.getStrategy())
