from brownie import accounts, web3, Wei, reverts, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
from brownie import Contract
from settings import *

# reset the chain after every test case
@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass

@pytest.fixture(scope="function")
def token_locks_active(token_lock,fixed_token2):

    unlockTime = chain.time() + 10
    
    fixed_token2.transfer(accounts[1], 2* TENPOW18, {"from": accounts[0]})
    balance_before_lock = fixed_token2.balanceOf(accounts[1])
    
    fixed_token2.approve(token_lock, 2* TENPOW18,{"from": accounts[1]})
    token_lock.lockTokens(fixed_token2, 
                           1 * TENPOW18,
                           unlockTime, 
                           accounts[1],
                            {"from":accounts[1]})
    balance_after_lock = fixed_token2.balanceOf(accounts[1])
    
    assert balance_before_lock - balance_after_lock== 1 * TENPOW18
    assert fixed_token2.balanceOf(token_lock) == 1 * TENPOW18

    fixed_token2.transfer(accounts[2], 2* TENPOW18, {"from": accounts[0]})
    balance_before_lock = fixed_token2.balanceOf(accounts[2])
    
    fixed_token2.approve(token_lock, 2* TENPOW18,{"from": accounts[2]})
    token_lock.lockTokens(fixed_token2, 
                           1 * TENPOW18,
                           unlockTime, 
                           accounts[2],
                            {"from":accounts[2]})
    balance_after_lock = fixed_token2.balanceOf(accounts[2])
    
    assert balance_before_lock - balance_after_lock== 1 * TENPOW18
    assert fixed_token2.balanceOf(token_lock) == 2 * TENPOW18



def test_wihdraw(token_locks_active,fixed_token2,token_lock):
    
    lock_id = 2
    amount,unlockTime, owner, userIndex = token_lock.getLockedItemAtId(lock_id)
    print(userIndex)
    print(amount)
    with reverts("LOCK MISMATCH"):
        token_lock.withdrawTokens(fixed_token2,userIndex,lock_id,amount, {"from":accounts[1]})

    
    lock_id = 1
    amount,unlockTime, owner, userIndex = token_lock.getLockedItemAtId(lock_id)
    print(userIndex)
    print(unlockTime)
    print(amount)
    with reverts("Not unlocked yet"):
        token_lock.withdrawTokens(fixed_token2,userIndex,lock_id,amount, {"from":accounts[1]})

    chain.sleep(100)
    chain.mine()
    lock_id = 1
    amount,unlockTime, owner, userIndex = token_lock.getLockedItemAtId(lock_id)
    print(userIndex)
    
    print(amount)
    token_lock.withdrawTokens(fixed_token2,userIndex,lock_id,amount, {"from":accounts[1]})
    assert fixed_token2.balanceOf(accounts[1]) == 2 * TENPOW18
    assert fixed_token2.balanceOf(token_lock) == 1 * TENPOW18


    
    lock_id = 2
    amount,unlockTime, owner, userIndex = token_lock.getLockedItemAtId(lock_id)
    print(userIndex)
    print(amount)
    token_lock.withdrawTokens(fixed_token2,userIndex,lock_id,amount, {"from":accounts[2]})
    assert fixed_token2.balanceOf(accounts[2]) == 2 * TENPOW18
    assert fixed_token2.balanceOf(token_lock) == 0 * TENPOW18
    amount,unlockTime, owner, userIndex = token_lock.getLockedItemAtId(lock_id)
    with reverts("token amount is Zero"):
        token_lock.withdrawTokens(fixed_token2,userIndex,lock_id,amount, {"from":accounts[2]})

def test_user_locked_item_at_index(token_locks_active,fixed_token2,token_lock):
    locked_token = token_lock.getUserLockedItemAtIndex(accounts[1],0)
    assert fixed_token2 == locked_token

def test_item_at_user_index(token_locks_active,fixed_token2,token_lock):
    amount, unlockTime, owner, _id = token_lock.getItemAtUserIndex(0,fixed_token2,accounts[1])

    assert amount == 1 * TENPOW18
    #assert unlockTime == chain.time() + 10
    assert _id == 1