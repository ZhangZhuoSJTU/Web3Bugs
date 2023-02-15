import pytest
from brownie import accounts, Ownable, Treasury, VaderBond, TestToken


@pytest.fixture(scope="session")
def deployer(accounts):
    yield accounts[0]


@pytest.fixture(scope="session")
def user(accounts):
    yield accounts[1]


# treasury withdraw destination
@pytest.fixture(scope="session")
def dest(accounts):
    yield accounts[2]


@pytest.fixture(scope="module")
def ownable(deployer):
    yield Ownable.deploy({"from": deployer})


@pytest.fixture(scope="module")
def treasury(deployer, payoutToken):
    yield Treasury.deploy(payoutToken, {"from": deployer})


@pytest.fixture(scope="module")
def bond(deployer, treasury, payoutToken, principalToken):
    yield VaderBond.deploy(treasury, payoutToken, principalToken, {"from": deployer})


# test contracts
@pytest.fixture(scope="module")
def payoutToken(deployer):
    yield TestToken.deploy("PAYOUT", "PAYOUT", 18, {"from": deployer})


@pytest.fixture(scope="module")
def principalToken(deployer):
    yield TestToken.deploy("PRINCIPAL TOKEN", "PRINCIPAL", 6, {"from": deployer})
