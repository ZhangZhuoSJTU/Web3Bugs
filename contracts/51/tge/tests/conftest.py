#!/usr/bin/python3

import pytest
import json
from brownie import ZERO_ADDRESS, chain

DAY = 86400
WEEK = DAY * 7
YEAR = 365 * 86400
EPOCH = WEEK


def approx(a, b, precision=1e-10):
    if a == b == 0:
        return True
    return 2 * abs(a - b) / (a + b) <= precision


def pytest_addoption(parser):
    parser.addoption(
        "--runlong", action="store_true", default=False, help="run long tests"
    )


def pytest_collection_modifyitems(config, items):
    if config.getoption("--runlong"):
        # --runslow given in cli: do not skip slow tests
        return
    skip_long = pytest.mark.skip(reason="need --runlong option to run")
    for item in items:
        if "long" in item.keywords:
            item.add_marker(skip_long)


@pytest.fixture(scope="function", autouse=True)
def isolate(fn_isolation):
    # perform a chain rewind after completing each test, to ensure proper isolation
    # https://eth-brownie.readthedocs.io/en/v1.10.3/tests-pytest-intro.html#isolation-fixtures
    pass


@pytest.fixture(scope="session")
def admin(accounts):
    return accounts[0] # owns the deployment process and resulting contract instances

@pytest.fixture(scope="session")
def alice(accounts):
    return accounts[1]

@pytest.fixture(scope="session")
def bob(accounts):
    return accounts[2]

@pytest.fixture(scope="session")
def chuck(accounts):
    return accounts[9] # malicious intent


@pytest.fixture(scope="module")
def mainToken(admin, MockERC20):
    return MockERC20.deploy("Mock Token", "MOCKT", {'from': admin})

@pytest.fixture(scope="module")
def nft(admin, MockERC20):
    return MockERC20.deploy("Mock NFT", "MOCKNF", {'from': admin})

@pytest.fixture(scope="module")
def vesting(admin, MockVesting):
    return MockVesting.deploy({'from': admin})

@pytest.fixture(scope="module")
def sale(admin, mainToken, nft, vesting, BasicSale):
    sale = BasicSale.deploy(
        mainToken,
        nft,
        vesting,
        7,        # daysPerEra
        5,        # firstPublicEra
        2118036_400000000000000000, # totalSupply 10x less than PublicSale for testing
          37111_000000000000000000, # initialDayEmission
        admin,
        {'from': admin})
    mainToken.approve(sale, sale.totalSupply(), {'from': admin})
    mainToken.mint(sale, sale.totalSupply(), {'from': admin})
    return sale


def advance_epochs(n, boot):
    for i in range(n):
        advance_one(boot)

def advance_one(boot):
    next = boot.start_epoch_time() + EPOCH
    chain.sleep(next - chain.time())
    boot.update_mining_parameters()
