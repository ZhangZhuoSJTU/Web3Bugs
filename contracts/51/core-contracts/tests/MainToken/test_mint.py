import brownie
import pytest
from brownie import ZERO_ADDRESS

DAY = 86400
WEEK = DAY * 7
YEAR = 365 * DAY


@pytest.fixture(scope="module")
def token(admin, chain, MainToken):
    token = MainToken.deploy("BOOT Finance Token", "BOOT", 18, {'from': admin})
    chain.sleep(86401)
    token.update_mining_parameters()
    return token


def test_available_supply(chain, token):
    creation_time = token.start_epoch_time()
    initial_supply = token.totalSupply()
    rate = token.rate()
    chain.sleep(DAY)
    chain.mine()

    expected = initial_supply + (chain[-1].timestamp - creation_time) * rate
    assert token.available_supply() == expected


def test_mint(admin, alice, chain, token):
    token.set_minter(admin, {"from": admin})
    creation_time = token.start_epoch_time()
    initial_supply = token.totalSupply()
    rate = token.rate()
    chain.sleep(DAY)

    amount = (chain.time() - creation_time) * rate
    token.mint(alice, amount, {"from": admin})

    assert token.balanceOf(alice) == amount
    assert token.totalSupply() == initial_supply + amount


def test_overmint(admin, alice, chain, token):
    token.set_minter(admin, {"from": admin})
    creation_time = token.start_epoch_time()
    rate = token.rate()
    chain.sleep(DAY)

    with brownie.reverts("dev: exceeds allowable mint amount"):
        token.mint(alice, (chain.time() - creation_time + 2) * rate, {"from": admin})


def test_minter_only(admin, alice, token):
    token.set_minter(admin, {"from": admin})
    with brownie.reverts("dev: minter only"):
        token.mint(alice, 0, {"from": alice})


def test_zero_address(admin, token):
    token.set_minter(admin, {"from": admin})
    with brownie.reverts("dev: zero address"):
        token.mint(ZERO_ADDRESS, 0, {"from": admin})
