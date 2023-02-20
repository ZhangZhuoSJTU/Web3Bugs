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


def _create_token(token_factory, token_template, name, symbol, total_supply, template_id, integrator_account, owner):
    data = token_template.getInitData(name, symbol, accounts[0], total_supply)
    tx = token_factory.createToken(template_id, integrator_account, data, {"from": owner})
    assert "TokenCreated" in tx.events
    return tx.return_value

########## TEST CREATE TOKEN ###################
def test_create_token(token_factory, fixed_token_template):
    name = "Fixed Token"
    symbol = "FXT"
    template_id = 1 # Fixed Token Template
    total_supply = 100 * TENPOW18 
    integrator_account = accounts[1]
    _create_token(token_factory, fixed_token_template, name, symbol, total_supply, template_id, integrator_account, accounts[0])

def test_add_token_template_wrong_operator(token_factory, fixed_token_template):
    with reverts("MISOTokenFactory: Sender must be operator"):
        token_factory.addTokenTemplate(fixed_token_template, {"from": accounts[2]})

def test_add_token_template_already_exist(token_factory,fixed_token_template):
    with reverts():
        token_factory.addTokenTemplate(fixed_token_template, {"from": accounts[0]})


def test_number_of_tokens(token_factory, fixed_token_template):
    name = "Fixed Token"
    symbol = "FXT"
    template_id = 1 # Fixed Token Template
    test_tokens = 100 * TENPOW18 
    integrator_account = accounts[1]
    number_of_tokens_before = token_factory.numberOfTokens()

    data = fixed_token_template.getInitData(name, symbol, accounts[0], test_tokens)
    tx = token_factory.createToken(template_id, integrator_account, data)
    assert "TokenCreated" in tx.events  

    name = "Mintable Token"
    symbol = "MNT"
    template_id = 2 # Mintable Token Template
    test_tokens = 0
    integrator_account = accounts[1]

    data = fixed_token_template.getInitData(name, symbol, accounts[0], test_tokens)
    tx = token_factory.createToken(template_id, integrator_account, data)
    assert "TokenCreated" in tx.events

    assert number_of_tokens_before + 2 == token_factory.numberOfTokens() 

def test_remove_token_template(token_factory):
    template_id = 1 # Fixed Token Template
    tx = token_factory.removeTokenTemplate(template_id,{"from": accounts[0]})

    assert "TokenTemplateRemoved" in tx.events
    assert token_factory.getTokenTemplate(template_id) == ZERO_ADDRESS
    
def test_token_factory_integrator_fee_accounts(token_factory,fixed_token_template):
    integrator_fee_account = accounts[6]
    miso_dev = accounts[5]
    minimum_fee = 0.1 * TENPOW18
    integrator_fee_percent = 10

    ETH_FOR_FEE = 1 * TENPOW18

    template_id = token_factory.getTemplateId(fixed_token_template)

    token_factory.setMinimumFee(minimum_fee,{"from":accounts[0]})
    token_factory.setIntegratorFeePct(integrator_fee_percent, {"from":accounts[0]})

    token_factory.setDividends(miso_dev, {"from":accounts[0]})
    before_deploy_balance_miso_dev = miso_dev.balance()
    before_deploy_balance_integrator = integrator_fee_account.balance()

    tx = token_factory.deployToken(template_id,integrator_fee_account,{"from":accounts[0],"value":ETH_FOR_FEE})

    assert "TokenCreated" in tx.events
    after_deploy_balance_miso_dev = miso_dev.balance()
    after_deploy_balance_integrator = integrator_fee_account.balance()

    assert after_deploy_balance_miso_dev > before_deploy_balance_miso_dev 
    assert after_deploy_balance_integrator - before_deploy_balance_integrator == 0.01 * TENPOW18
    assert token_factory.integratorFeePct() == integrator_fee_percent
    ######## Fail cases ########################
    with reverts("MISOTokenFactory: Failed to transfer minimumFee"):
        tx = token_factory.deployToken(template_id,integrator_fee_account,{"from":accounts[0],"value":0})
    
    template_id = 100
    with reverts():
        token_factory.deployToken(template_id,integrator_fee_account)

    ###########  Checking ZEROADDRESS Integrator account#######
    integrator_fee_account = ZERO_ADDRESS
    
    template_id = token_factory.getTemplateId(fixed_token_template)
    before_deploy_balance_miso_dev = miso_dev.balance()
    tx = token_factory.deployToken(template_id,integrator_fee_account,{"from":accounts[0],"value":ETH_FOR_FEE})
    assert "TokenCreated" in tx.events
    after_deploy_balance_miso_dev = miso_dev.balance()
    assert after_deploy_balance_miso_dev - before_deploy_balance_miso_dev == 1 * TENPOW18
    

    ########## Checking Miso Dev Integrator account ###############
    integrator_fee_account = miso_dev
    
    template_id = token_factory.getTemplateId(fixed_token_template)
    before_deploy_balance_miso_dev = miso_dev.balance()
    tx = token_factory.deployToken(template_id,integrator_fee_account,{"from":accounts[0],"value":ETH_FOR_FEE})
    assert "TokenCreated" in tx.events
    after_deploy_balance_miso_dev = miso_dev.balance()
    assert after_deploy_balance_miso_dev - before_deploy_balance_miso_dev == 1 * TENPOW18

def test_token_factory_set_minimum_fee_with_not_operator(token_factory):
    minimum_fee = 0.1 * TENPOW18
    with reverts():
        token_factory.setMinimumFee(minimum_fee, {"from":accounts[9]})

def test_token_factory_set_integrator_pct_not_operator(token_factory):
    integrator_fee_percent = 10
    with reverts("MISOTokenFactory: Sender must be operator"):
        token_factory.setIntegratorFeePct(integrator_fee_percent, {"from":accounts[9]})

def test_token_factory_set_integrator_pct_not_in_range(token_factory):
    integrator_fee_percent = 2000
    with reverts("MISOTokenFactory: Range is from 0 to 1000"):
        token_factory.setIntegratorFeePct(integrator_fee_percent, {"from":accounts[0]})

def test_token_factory_remove_template_not_operator(token_factory):
    with reverts():
        token_factory.removeTokenTemplate(1, {"from":accounts[5]})

    
def test_token_factory_set_dividends_not_operator(token_factory):
    miso_dev = accounts[5]
    with reverts():
        token_factory.setDividends(miso_dev,{"from":accounts[5]})

def test_token_factory_init_again(token_factory,miso_access_controls):
    with reverts():
        token_factory.initMISOTokenFactory(miso_access_controls, {'from': accounts[0]})