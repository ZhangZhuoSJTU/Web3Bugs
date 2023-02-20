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

@pytest.fixture(scope='function')
def fixed_token_cal(FixedToken):
    fixed_token_cal = FixedToken.deploy({'from': accounts[0]})
    name = "Fixed Token Cal"
    symbol = "CAL"
    owner = accounts[0]

    fixed_token_cal.initToken(name, symbol, owner,AUCTION_TOKENS, {'from': owner})
    assert fixed_token_cal.name() == name
    assert fixed_token_cal.symbol() == symbol
    assert fixed_token_cal.totalSupply() == AUCTION_TOKENS
    assert fixed_token_cal.balanceOf(owner) == AUCTION_TOKENS

    return fixed_token_cal

@pytest.fixture(scope='function')
def farm_template_2(MISOMasterChef):
    farm_template_2 = MISOMasterChef.deploy({"from":accounts[0]})
    return farm_template_2


@pytest.fixture(scope='function')
def create_farm(farm_factory, farm_template, fixed_token_cal, miso_access_controls):
    rewards_per_block = 1 * TENPOW18
    # Define the start time relative to sales
    start_block =  len(chain) + 10
    wallet = accounts[4]
    dev_addr = wallet
    fixed_token_cal.approve(farm_factory, AUCTION_TOKENS, {"from": accounts[0]})
    integratorFeeAccount = accounts[6]
    miso_dev = accounts[5]
    integratorFeeAccount = accounts[6]

    before_deploy_balance_miso_dev = miso_dev.balance()
    before_deploy_balance_integrator = integratorFeeAccount.balance()

    data = farm_template.getInitData(fixed_token_cal, rewards_per_block, start_block, dev_addr, miso_access_controls)
    tx = farm_factory.createFarm(1,wallet, data,{"from":accounts[0]})

    assert "FarmCreated" in tx.events
    assert farm_factory.numberOfFarms() == 1
    
    after_deploy_balance_miso_dev = miso_dev.balance()
    after_deploy_balance_integrator = integratorFeeAccount.balance()
    
    assert before_deploy_balance_miso_dev==after_deploy_balance_miso_dev
    assert before_deploy_balance_integrator == after_deploy_balance_integrator


def test_farm_factory_wrong_operator_add_template(create_farm,farm_factory,farm_template_2):
    with reverts():
        farm_factory.addFarmTemplate(farm_template_2,{"from":accounts[5]})

def test_farm_factory_remove_farm_template(farm_factory,farm_template_2):
    tx = farm_factory.addFarmTemplate(farm_template_2,{"from":accounts[0]})
    template_id = tx.events["FarmTemplateAdded"]["templateId"]
    assert template_id == 2
    tx = farm_factory.removeFarmTemplate(template_id, {"from":accounts[0]})
    assert "FarmTemplateRemoved" in tx.events 

def test_farm_factory_get_farm_template(farm_factory,farm_template):
    get_farm_template = farm_factory.getFarmTemplate(1)
    assert get_farm_template == farm_template

def test_farm_factory_get_farm_template_id(farm_factory,farm_template_2):
    tx = farm_factory.addFarmTemplate(farm_template_2,{"from":accounts[0]})
    template_id = tx.events["FarmTemplateAdded"]["templateId"]
    assert farm_factory.getTemplateId(farm_template_2) == template_id

def test_farm_factory_template_same_add_again(farm_factory,farm_template):
    with reverts():
        farm_factory.addFarmTemplate(farm_template,{"from":accounts[0]})

def test_farm_factory_again_initialize(miso_access_controls,farm_template,farm_factory):
    miso_dev = accounts[0]
    minimum_fee = 0 
    token_fee = 0
    with reverts():
        farm_factory.initMISOFarmFactory(miso_access_controls,miso_dev, minimum_fee, token_fee,{"from":accounts[0]})
   
def test_farm_factory_remove_not_created_template(farm_factory,farm_template_2):
    with reverts():
        farm_factory.removeFarmTemplate(5, {"from":accounts[0]})

def test_farm_factory_integrator_fee_accounts(farm_template,miso_access_controls,MISOFarmFactory,farm_factory):
    integratorFeeAccount = accounts[6]
    miso_dev = accounts[5]
    minimum_fee = 0.1 * TENPOW18
    integrator_fee_percent = 10

    ETH_FOR_FEE = 1 * TENPOW18
   

    template_id = farm_factory.getTemplateId(farm_template)

    before_deploy_balance_miso_dev = miso_dev.balance()
    before_deploy_balance_integrator = integratorFeeAccount.balance()
    
    farm_factory.setMinimumFee(minimum_fee, {"from":accounts[0]})
    farm_factory.setIntegratorFeePct(integrator_fee_percent, {"from":accounts[0]})

    farm_factory.setDividends(miso_dev,{"from":accounts[0]})
    tx = farm_factory.deployFarm(template_id,integratorFeeAccount,{"from":accounts[0],"value":ETH_FOR_FEE})

    assert "FarmCreated" in tx.events
    after_deploy_balance_miso_dev = miso_dev.balance()
    after_deploy_balance_integrator = integratorFeeAccount.balance()

    assert after_deploy_balance_miso_dev > before_deploy_balance_miso_dev 
    assert after_deploy_balance_integrator - before_deploy_balance_integrator == 0.01 * TENPOW18

    ######## Fail cases ########################
    with reverts("MISOFarmFactory: Failed to transfer minimumFee"):
        tx = farm_factory.deployFarm(template_id,integratorFeeAccount,{"from":accounts[0],"value":0})
    
    template_id = 100
    with reverts():
        farm_factory.deployFarm(template_id,integratorFeeAccount)

    ###########  Checking ZEROADDRESS Integrator account#######
    integrator_fee_account = ZERO_ADDRESS
    
    template_id = farm_factory.getTemplateId(farm_template)
    before_deploy_balance_miso_dev = miso_dev.balance()
    tx = farm_factory.deployFarm(template_id,integrator_fee_account,{"from":accounts[0],"value":ETH_FOR_FEE})
    assert "FarmCreated" in tx.events
    after_deploy_balance_miso_dev = miso_dev.balance()
    assert after_deploy_balance_miso_dev - before_deploy_balance_miso_dev == 1 * TENPOW18
    

    ########## Checking Miso Dev Integrator account ###############
    integrator_fee_account = miso_dev
    
    template_id = farm_factory.getTemplateId(farm_template)
    before_deploy_balance_miso_dev = miso_dev.balance()
    tx = farm_factory.deployFarm(template_id,integrator_fee_account,{"from":accounts[0],"value":ETH_FOR_FEE})
    assert "FarmCreated" in tx.events
    after_deploy_balance_miso_dev = miso_dev.balance()
    assert after_deploy_balance_miso_dev - before_deploy_balance_miso_dev == 1 * TENPOW18

def test_farm_factory_set_minimum_fee_with_not_operator(farm_factory):
    minimum_fee = 0.1 * TENPOW18
    with reverts():
        farm_factory.setMinimumFee(minimum_fee, {"from":accounts[9]})

def test_farm_factory_set_integrator_pct_not_operator(farm_factory):
    integrator_fee_percent = 10
    with reverts("MISOFarmFactory: Sender must be operator"):
        farm_factory.setIntegratorFeePct(integrator_fee_percent, {"from":accounts[9]})

def test_farm_factory_set_integrator_pct_not_in_range(farm_factory):
    integrator_fee_percent = 2000
    with reverts("MISOFarmFactory: Range is from 0 to 1000"):
        farm_factory.setIntegratorFeePct(integrator_fee_percent, {"from":accounts[0]})

def test_farm_factory_remove_farm_template_not_operator(farm_factory):
    with reverts():
        farm_factory.removeFarmTemplate(1, {"from":accounts[5]})

def test_farm_factory_set_dividends_not_operator(farm_factory):
    miso_dev = accounts[5]
    with reverts():
        farm_factory.setDividends(miso_dev,{"from":accounts[5]})