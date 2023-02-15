from brownie import accounts, web3, Wei, reverts, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
from brownie import Contract
from settings import *

TOKEN_1_AMOUNT = 10000
TOTAL_LP_AMOUNT = 10000000000

@pytest.fixture(scope='function')
def token_1(FixedToken):
    token = FixedToken.deploy({'from': accounts[0]})
    name = "Token 1"
    symbol = "T1"
    owner = accounts[0]

    token.initToken(name, symbol, owner, TOKEN_1_AMOUNT, {'from': owner})

    return token

@pytest.fixture(scope='function')
def fake_lp_token(FixedToken):
    lp_token = FixedToken.deploy({'from': accounts[0]})
    name = "LP Token"
    symbol = "LPT"
    owner = accounts[0]

    lp_token.initToken(name, symbol, owner, TOTAL_LP_AMOUNT, {'from': owner})

    lp_token.transfer(accounts[1], 1000, {'from': owner})
    lp_token.transfer(accounts[2], 1000, {'from': owner})
    lp_token.transfer(accounts[3], 1000, {'from': owner})

    return lp_token


@pytest.fixture(scope='function')
def farm(MISOMasterChef, farm_factory, farm_template, token_1, fake_lp_token):
    rewards_per_block = 1 * TENPOW18
    # Define the start time relative to sales
    start_block = len(chain) + 10
    wallet = accounts[4]
    dev_addr = wallet
    admin = accounts[1]
    token_1.approve(farm_factory, TOTAL_LP_AMOUNT, {"from": accounts[0]})

    data = farm_template.getInitData(token_1, rewards_per_block, start_block, dev_addr, admin)
    tx = farm_factory.createFarm(1, wallet, data, {"from": accounts[0]})

    assert "FarmCreated" in tx.events
    farm_address = tx.events["FarmCreated"]["addr"]
    farm = MISOMasterChef.at(farm_address)

    assert farm.rewards() == token_1
    assert farm.rewardsPerBlock() == rewards_per_block
    assert farm.startBlock() == start_block
    assert farm.devaddr() == dev_addr

    fake_lp_token.approve(farm, 90, {"from": accounts[0]})

    farm.addToken(100, fake_lp_token, True, {"from": admin})

    assert farm.poolInfo(0)[0] == fake_lp_token
    assert farm.poolInfo(0)[1] == 100

    return farm

def test_deposit(farm, fake_lp_token):
    fake_lp_token.approve(farm, 1000, {'from': accounts[1]})

    farm.deposit(0, 100, {'from': accounts[1]})

    assert fake_lp_token.balanceOf(accounts[1]) == 900


def test_emergencyWithdraw(farm, fake_lp_token):
    fake_lp_token.approve(farm, 1000, {'from': accounts[1]})

    farm.deposit(0, 100, {'from': accounts[1]})

    assert fake_lp_token.balanceOf(accounts[1]) == 900

    farm.emergencyWithdraw(0, {'from': accounts[1]})
    assert fake_lp_token.balanceOf(accounts[1]) == 1000
