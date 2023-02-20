from brownie import reverts
from brownie.test import given, strategy
from conftest import MAX_UINT256, ONE_DAY, ONE_WEEK, ONE_YEAR
import time

AIRDROP_ADDR = "0x28d6037EDEAf8ec2c91c9b2cF9A1643111d8F198"
AIRDROP_EXPECTED = 4297396

def test_add_investor(admin, alice, invest):
    invest.addInvestor(alice, 10**18, {"from":admin})

def test_add_investor_(chuck, invest):
    with reverts():
        invest.addInvestor(chuck, 10**18, {"from":chuck})

def test_premature_claim(chuck, invest):
    with reverts():
        invest.claim({"from": chuck})

def test_update_emissions_too_soon(invest, chain):
    with reverts():
        invest.updateEmission()
    chain.sleep(ONE_WEEK // 2)
    with reverts():
        invest.updateEmission()

def test_update_emissions(invest, chain, vesting):
    assert(0 == invest.miningEpoch())
    chain.sleep(ONE_WEEK)
    invest.updateEmission()
    assert(1 == invest.miningEpoch())

def test_expected_return(admin, alice, invest, chain, token, vesting):
    chain.sleep(ONE_WEEK//2)
    invest.addInvestor(alice, 10**18, {"from":admin})
    assert(token.balanceOf(alice) == 0)
    invest.claim({"from": alice})
    assert(token.balanceOf(alice) > 0)

def test_multiple_claims(admin, alice, invest, chain, token, vesting):
    chain.sleep(ONE_WEEK//2)
    invest.addInvestor(alice, 10**18, {"from":admin})
    assert(token.balanceOf(alice) == 0)
    invest.claim({"from": alice})
    balance = token.balanceOf(alice)
    chain.sleep(ONE_DAY)
    invest.claim({"from": alice})
    assert(token.balanceOf(alice) > balance)
