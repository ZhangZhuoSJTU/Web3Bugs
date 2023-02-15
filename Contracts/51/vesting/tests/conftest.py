#!/usr/bin/python3

import pytest
from brownie import chain


MAX_UINT256 = 2**256 - 1
ONE_DAY = 24 * 60 * 60
ONE_WEEK = 7 * ONE_DAY
ONE_YEAR = 52 * ONE_WEEK
ONE_MONTH = ONE_YEAR // 12


def approx(a, b, precision=1e-5):
    if a == b == 0:
        return True
    return 2 * abs(a - b) / (a + b) <= precision


def sleep_from(tx, time):
    chain.sleep(time - (chain.time() - tx.timestamp))


@pytest.fixture(autouse=True)
def isolation_setup(fn_isolation):
    pass


@pytest.fixture(scope="session")
def admin(accounts):
    return accounts[0]


@pytest.fixture(scope="session")
def ben(accounts):
    return accounts[1]


@pytest.fixture(scope="session")
def alice(accounts):
    return accounts[2]


@pytest.fixture(scope="session")
def charlie(accounts):
    return accounts[3]


@pytest.fixture(scope="session")
def chuck(accounts):
    return accounts[4]


@pytest.fixture(scope="module")
def token(admin, Token):
    contract = Token.deploy({"from": admin})
    assert contract.balanceOf(admin) > 0
    return contract

@pytest.fixture(scope="module")
def base_amount(token):
    return 10 ** token.decimals()


@pytest.fixture(scope="module")
def vesting(admin, token, Vesting):
    contract = Vesting.deploy(token, admin, {"from": admin})
    token.approve(contract, token.balanceOf(admin), {"from": admin})
    return contract


@pytest.fixture(scope="module")
def airdrop(admin, token, AirdropDistribution, vesting):
    airdropper = AirdropDistribution.deploy(token, vesting, {"from": admin})
    token.transfer(airdropper, 1_000_000_000 * 10**18, {"from": admin})
    return airdropper


@pytest.fixture(scope="module")
def invest(admin, token, InvestorDistribution, vesting):
    invester = InvestorDistribution.deploy(token, vesting, {"from": admin})
    token.transfer(invester, 1_000_000_000 * 10**18, {"from": admin})
    return invester
