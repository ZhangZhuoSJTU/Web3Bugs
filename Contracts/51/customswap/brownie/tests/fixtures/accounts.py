import pytest


@pytest.fixture(scope="session")
def admin(accounts):
    return accounts[0] # owns the deployment process and resulting contract instances

@pytest.fixture(scope="session")
def provider(accounts):
    return accounts[1] # provides liquidity, synonym for trader1

@pytest.fixture(scope="session")
def provider1(accounts):
    return accounts[1] # provides liquidity

@pytest.fixture(scope="session")
def provider2(accounts):
    return accounts[2] # provides liquidity 

@pytest.fixture(scope="session")
def provider3(accounts):
    return accounts[3] # provides liquidity 

@pytest.fixture(scope="session")
def trader(accounts):
    return accounts[4] # trades/swaps via custom swap, synonym for trader1

@pytest.fixture(scope="session")
def trader1(accounts):
    return accounts[4] # trades/swaps via custom swap

@pytest.fixture(scope="session")
def trader2(accounts):
    return accounts[5] # trades/swaps via custom swap

@pytest.fixture(scope="session")
def trader3(accounts):
    return accounts[6] # trades/swaps via custom swap

@pytest.fixture(scope="session")
def alice(accounts):
    return accounts[7] # synonym for account1

@pytest.fixture(scope="session")
def bob(accounts):
    return accounts[8] # trades/swaps via custom swap

@pytest.fixture(scope="session")
def charlie(accounts):
    return accounts[9] # never has any coins to begin with
