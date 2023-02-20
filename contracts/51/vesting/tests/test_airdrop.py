from brownie import reverts
from brownie.test import given, strategy
from conftest import MAX_UINT256, ONE_DAY, ONE_WEEK, ONE_YEAR
import time

AIRDROP_ADDR = "0x28d6037EDEAf8ec2c91c9b2cF9A1643111d8F198"
AIRDROP_EXPECTED = 4297396

def test_validate_only_once(admin, airdrop, vesting):
    airdrop.validate({"from":AIRDROP_ADDR})
    with reverts():
        airdrop.validate({"from":AIRDROP_ADDR})

def test_premature_claim(airdrop, vesting):
    with reverts():
        airdrop.claim({"from": AIRDROP_ADDR})

def test_update_emissions_too_soon(airdrop, chain):
    with reverts():
        airdrop.updateEmission()
    chain.sleep(ONE_WEEK // 2)
    with reverts():
        airdrop.updateEmission()

def test_update_emissions(airdrop, chain, vesting):
    assert(0 == airdrop.miningEpoch())
    chain.sleep(ONE_WEEK)
    airdrop.updateEmission()
    assert(1 == airdrop.miningEpoch())

def test_expected_return(airdrop, chain, token, vesting):
    chain.sleep(ONE_WEEK//2)
    airdrop.validate({"from":AIRDROP_ADDR})
    assert(token.balanceOf(AIRDROP_ADDR) == 0)
    airdrop.claim({"from": AIRDROP_ADDR})
    assert(token.balanceOf(AIRDROP_ADDR) > 0)

def test_multiple_claims(airdrop, chain, token, vesting):
    chain.sleep(ONE_WEEK//2)
    airdrop.validate({"from":AIRDROP_ADDR})
    assert(token.balanceOf(AIRDROP_ADDR) == 0)
    airdrop.claim({"from": AIRDROP_ADDR})
    balance = token.balanceOf(AIRDROP_ADDR)
    chain.sleep(ONE_DAY)
    airdrop.claim({"from": AIRDROP_ADDR})
    assert(token.balanceOf(AIRDROP_ADDR) > balance)
