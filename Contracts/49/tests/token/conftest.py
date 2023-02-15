import pytest
from brownie import OverlayToken


@pytest.fixture(scope="module")
def gov(accounts):
    yield accounts[0]


@pytest.fixture(scope="module")
def alice(accounts):
    yield accounts[1]


@pytest.fixture(scope="module")
def bob(accounts):
    yield accounts[2]


@pytest.fixture(scope="module")
def rando(accounts):
    yield accounts[3]


@pytest.fixture(scope="module", params=[8000000])
def create_token(gov, alice, bob, request):
    sup = request.param

    def create_token(supply=sup):
        tok = gov.deploy(OverlayToken)
        tok.mint(gov, supply * 10 ** tok.decimals(), {"from": gov})
        tok.transfer(bob, supply * 10 ** tok.decimals(), {"from": gov})
        return tok

    yield create_token


@pytest.fixture(scope="module")
def token(create_token):
    yield create_token()


@pytest.fixture(scope="module")
def create_minter(token, gov, accounts):
    def create_minter(tok=token, governance=gov):
        tok.grantRole(tok.MINTER_ROLE(), accounts[4], {"from": gov})
        return accounts[4]

    yield create_minter


@pytest.fixture(scope="module")
def minter(create_minter):
    yield create_minter()


@pytest.fixture(scope="module")
def create_burner(token, gov, accounts):
    def create_burner(tok=token, governance=gov):
        tok.grantRole(tok.BURNER_ROLE(), accounts[5], {"from": gov})
        return accounts[5]

    yield create_burner


@pytest.fixture(scope="module")
def burner(create_burner):
    yield create_burner()


@pytest.fixture(scope="module")
def create_admin(token, gov, accounts):
    def create_admin(tok=token, governance=gov):
        tok.grantRole(tok.ADMIN_ROLE(), accounts[6], {"from": gov})
        return accounts[6]

    yield create_admin


@pytest.fixture(scope="module")
def admin(create_admin):
    yield create_admin()


@pytest.fixture(scope="module")
def create_market(token, admin, accounts):
    def create_market(tok=token, adm=admin):
        tok.grantRole(tok.MINTER_ROLE(), accounts[7], {"from": adm})
        tok.grantRole(tok.BURNER_ROLE(), accounts[7], {"from": adm})
        return accounts[7]

    yield create_market


@pytest.fixture(scope="module")
def market(create_market):
    yield create_market()
