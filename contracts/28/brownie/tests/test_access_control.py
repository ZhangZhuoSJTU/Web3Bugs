from brownie import accounts, web3, Wei, reverts, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
from brownie import Contract
from settings import *

def test_smart_contract_role(miso_access_controls):
    miso_access_controls.addSmartContractRole(accounts[1],{"from":accounts[0]})
    assert(miso_access_controls.hasSmartContractRole(accounts[1]))

    miso_access_controls.removeSmartContractRole(accounts[1],{"from":accounts[0]})
    assert(miso_access_controls.hasSmartContractRole(accounts[1])==False)

def test_minter_role(miso_access_controls):
    miso_access_controls.addMinterRole(accounts[1],{"from":accounts[0]})
    assert(miso_access_controls.hasMinterRole(accounts[1]))

    miso_access_controls.removeMinterRole(accounts[1],{"from":accounts[0]})
    assert(miso_access_controls.hasMinterRole(accounts[1])==False)

def test_operator_role(miso_access_controls):
    miso_access_controls.addOperatorRole(accounts[1],{"from":accounts[0]})
    assert(miso_access_controls.hasOperatorRole(accounts[1]))

    miso_access_controls.removeOperatorRole(accounts[1],{"from":accounts[0]})
    assert(miso_access_controls.hasOperatorRole(accounts[1])==False)

def test_admin_role(miso_access_controls):
    miso_access_controls.addAdminRole(accounts[1],{"from":accounts[0]})
    assert(miso_access_controls.hasAdminRole(accounts[1]))

    miso_access_controls.removeAdminRole(accounts[1],{"from":accounts[0]})
    assert(miso_access_controls.hasAdminRole(accounts[1])==False)

def test_init_again(miso_access_controls):
    with reverts("Already initialised"):
        miso_access_controls.initAccessControls(accounts[0], {"from":accounts[0]})