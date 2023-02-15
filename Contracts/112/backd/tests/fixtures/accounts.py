import pytest
from support.utils import scale


@pytest.fixture(scope="session")
def alice(accounts):
    return accounts[0]


@pytest.fixture(scope="session")
def bob(accounts):
    return accounts[1]


@pytest.fixture(scope="session")
def charlie(accounts):
    return accounts[2]


@pytest.fixture(scope="session")
def admin(accounts):
    return accounts[3]


@pytest.fixture(scope="session")
def gov(accounts):
    return accounts[4]


@pytest.fixture(scope="session")
def treasury(accounts):
    return accounts[5]


@pytest.fixture(scope="session")
def mockAddress(accounts):
    return accounts[6]


@pytest.fixture
def gnosisSafe(accounts, bob):
    safe = accounts[11]
    bob.transfer(safe, scale(1))
    return safe
