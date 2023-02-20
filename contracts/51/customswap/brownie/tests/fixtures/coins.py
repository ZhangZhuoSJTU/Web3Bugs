import pytest
from brownie import ETH_ADDRESS, ZERO_ADDRESS, ERC20Mock, ERC20MockNoReturn
from brownie_tokens import MintableForkToken
from conftest import WRAPPED_COIN_METHODS

# public fixtures - these can be used when testing


@pytest.fixture(scope="module")
def USDT(ERC20Mock, admin):
    return ERC20Mock.deploy("USDT Token", "USDT", 18, {'from': admin})


@pytest.fixture(scope="module")
def USDC(ERC20Mock, admin):
    return ERC20Mock.deploy("USDC Token", "USDC", 18, {'from': admin})


@pytest.fixture(scope="module")
def TUSD(ERC20Mock, admin):
    return ERC20Mock.deploy("TUSD Token", "TUSD", 18, {'from': admin})


@pytest.fixture(scope="module")
def DAI(ERC20Mock, admin):
    return ERC20Mock.deploy("DAI Token", "DAI", 18, {'from': admin})


@pytest.fixture(scope="module")
def coins(DAI, USDC):
    return [DAI, USDC]


@pytest.fixture(scope="module")
def decimals(coins):
    return [coin.decimals() for coin in coins]
