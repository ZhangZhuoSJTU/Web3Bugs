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
    # assert fixed_token_cal.owner() == owner
    # changed to access controls

    assert fixed_token_cal.totalSupply() == AUCTION_TOKENS
    assert fixed_token_cal.balanceOf(owner) == AUCTION_TOKENS

    return fixed_token_cal

@pytest.fixture(scope='function')
def auction_factory_template(auction_factory,dutch_auction_template):
    #tx = auction_factory.addAuctionTemplate(dutch_auction_template, {"from": accounts[0]})

    template_type = 2  # Dutch Auction is 2
    template_id = auction_factory.currentTemplateId(template_type)
    
   # assert "AuctionTemplateAdded" in tx.events
    dutch_auction_template  =  auction_factory.getAuctionTemplate(template_id)

    assert auction_factory.getTemplateId(dutch_auction_template) == template_id

@pytest.fixture(scope = 'function')
def crowdsale_template_2(Crowdsale):
    crowdsale_template_2 = Crowdsale.deploy({"from":accounts[0]})
    return crowdsale_template_2


@pytest.fixture(scope='function')
def crowdsale_factory_template(auction_factory,crowdsale_template):
   # tx = auction_factory.addAuctionTemplate(crowdsale_template, {"from": accounts[0]})
    #assert "AuctionTemplateAdded" in tx.events
    template_type = 1  # Crowdsale type is 1
    template_id = auction_factory.currentTemplateId(template_type)
    
    crowdsale_template = auction_factory.getAuctionTemplate(template_id)
    assert auction_factory.getTemplateId(crowdsale_template) == template_id

def test_market_add_auction_template_twice(auction_factory,crowdsale_template,crowdsale_factory_template):
    with reverts():
        auction_factory.addAuctionTemplate(crowdsale_template,{"from": accounts[0]})

def test_remove_auction_template(auction_factory,crowdsale_template):
    template_type = 1  # Crowdsale type is 1
    template_id = auction_factory.currentTemplateId(template_type)
    auction_factory.removeAuctionTemplate(template_id,{"from":accounts[0]})
    return auction_factory

def test_add_again_after_removal(auction_factory,crowdsale_template):
    auction_factory = test_remove_auction_template(auction_factory,crowdsale_template)
    auction_factory.addAuctionTemplate(crowdsale_template,{"from": accounts[0]})

def test_market_create_auction_data(DutchAuction, auction_factory,dutch_auction_template,fixed_token_cal):
    assert fixed_token_cal.balanceOf(accounts[0]) == AUCTION_TOKENS
    template_id = auction_factory.getTemplateId(dutch_auction_template)
    minimum_fee = 0.1 * TENPOW18
    integrator_fee_percent = 10
    ETH_TO_FEE = 1 * TENPOW18
    auction_factory.setMinimumFee(minimum_fee,{"from":accounts[0]})
    auction_factory.setIntegratorFeePct(integrator_fee_percent, {"from":accounts[0]})
    
    start_date = chain.time() + 20
    end_date = start_date + AUCTION_TIME
    operator = accounts[0]
    wallet = accounts[1]
    
    chain.sleep(10)
    
    fixed_token_cal.approve(auction_factory, AUCTION_TOKENS, {"from": accounts[0]})
    _data = dutch_auction_template.getAuctionInitData(
        auction_factory,
        fixed_token_cal,
        AUCTION_TOKENS,
        start_date,
        end_date,
        ETH_ADDRESS,
        AUCTION_START_PRICE,
        AUCTION_RESERVE,
        operator,
        ZERO_ADDRESS,
        wallet,
        {"from": accounts[0]}
    )
    
    
    tx = auction_factory.createMarket(template_id,fixed_token_cal,AUCTION_TOKENS,wallet, _data,{"from":accounts[0],"value": ETH_TO_FEE})
    assert "Approval" in tx.events
    new_dutch_auction = tx.return_value
    assert fixed_token_cal.balanceOf(new_dutch_auction) == AUCTION_TOKENS
    new_dutch_auction = DutchAuction.at(new_dutch_auction)
    chain.sleep(30)
    eth_to_transfer = 10 * TENPOW18
    tx = new_dutch_auction.commitEth(accounts[0],  True, {"from":accounts[0],"value":eth_to_transfer})
    assert "AddedCommitment" in tx.events
    
    assert auction_factory.numberOfAuctions() == 1

    ##### Bad Case Fail ############

    token_address = ZERO_ADDRESS

    _data = dutch_auction_template.getAuctionInitData(
        auction_factory,
        token_address,
        AUCTION_TOKENS,
        start_date,
        end_date,
        ETH_ADDRESS,
        AUCTION_START_PRICE,
        AUCTION_RESERVE,
        operator,
        ZERO_ADDRESS,
        wallet,
        {"from": accounts[0]}
    )
    with reverts():
        auction_factory.createMarket(template_id,token_address,AUCTION_TOKENS,wallet, _data,{"from":accounts[0],"value":eth_to_transfer})

    #############Failed to transfer minimumFee########
    # _data = dutch_auction_template.getAuctionInitData(
    #     auction_factory,
    #     fixed_token_cal,
    #     AUCTION_TOKENS,
    #     start_date,
    #     end_date,
    #     ETH_ADDRESS,
    #     AUCTION_START_PRICE,
    #     AUCTION_RESERVE,
    #     operator,
    #     ZERO_ADDRESS,
    #     wallet, {"from": accounts[0]}
    # )
    # with reverts("MISOMarket: Failed to transfer minimumFee"):
    #     auction_factory.createMarket(template_id,fixed_token_cal,AUCTION_TOKENS,wallet,_data,{"from":accounts[0],"value":0})
    
    # """ fixed_token_cal.approve(auction_factory, AUCTION_TOKENS, {"from": accounts[0]})
    
    # Auction_Tokens = 0 * TENPOW18
    # _data = dutch_auction_template.getAuctionInitData(auction_factory, fixed_token_cal, Auction_Tokens, start_date, end_date, ETH_ADDRESS, AUCTION_START_PRICE, AUCTION_RESERVE, operator, ZERO_ADDRESS, wallet, {"from": accounts[0]})
    
    # auction_factory.createMarket(template_id,fixed_token_cal,Auction_Tokens,wallet, _data,{"from":accounts[0],"value":ETH_TO_FEE})
    # """

def test_create_crowdsale_data(Crowdsale,auction_factory, fixed_token_cal, crowdsale_template):
    assert fixed_token_cal.balanceOf(accounts[0]) == AUCTION_TOKENS
    start_time = chain.time() + 10
    end_time = start_time + CROWDSALE_TIME
    operator = accounts[0]
    wallet = accounts[1]
    template_id = auction_factory.getTemplateId(crowdsale_template)
    
    fixed_token_cal.approve(auction_factory, CROWDSALE_TOKENS, {"from": accounts[0]})

    _data = crowdsale_template.getCrowdsaleInitData(
        auction_factory,
        fixed_token_cal,
        ETH_ADDRESS,
        CROWDSALE_TOKENS,
        start_time,
        end_time,
        CROWDSALE_RATE,
        CROWDSALE_GOAL,
        operator,
        ZERO_ADDRESS,
        wallet,
        {"from": accounts[0]}
    )

    new_crowdsale = auction_factory.createMarket(template_id,fixed_token_cal,CROWDSALE_TOKENS,wallet,_data).return_value
    new_crowdsale = Crowdsale.at(new_crowdsale)
    chain.sleep(20)
    
    token_buyer =  accounts[1]
    eth_to_transfer = 5 * TENPOW18
    
    tx = new_crowdsale.commitEth(token_buyer, True, {"value": eth_to_transfer, "from": token_buyer})
    assert 'AddedCommitment' in tx.events

def test_market_integrator_fee_accounts(auction_factory,fixed_token_cal, crowdsale_template):
    
    ##########Test Happy Case ############
    integrator_fee_account = accounts[6]
    miso_dev = accounts[5]
    minimum_fee = 0.1 * TENPOW18
    integrator_fee_percent = 10

    ETH_FOR_FEE = 1 * TENPOW18

    template_id = auction_factory.getTemplateId(crowdsale_template)

    auction_factory.setMinimumFee(minimum_fee,{"from":accounts[0]})
    auction_factory.setIntegratorFeePct(integrator_fee_percent, {"from":accounts[0]})

    auction_factory.setDividends(miso_dev, {"from":accounts[0]})
    before_deploy_balance_miso_dev = miso_dev.balance()
    before_deploy_balance_integrator = integrator_fee_account.balance()

    tx = auction_factory.deployMarket(template_id,integrator_fee_account,{"from":accounts[0],"value":ETH_FOR_FEE})

    assert "MarketCreated" in tx.events
    after_deploy_balance_miso_dev = miso_dev.balance()
    after_deploy_balance_integrator = integrator_fee_account.balance()
    assert after_deploy_balance_miso_dev > before_deploy_balance_miso_dev 
    assert after_deploy_balance_integrator - before_deploy_balance_integrator == 0.01 * TENPOW18


    ######## Fail cases ########################
    with reverts("MISOMarket: Failed to transfer minimumFee"):
        tx = auction_factory.deployMarket(template_id,integrator_fee_account,{"from":accounts[0],"value":0})
    
    template_id = 100
    with reverts():
        auction_factory.deployMarket(template_id,integrator_fee_account)

    ###########  Checking ZEROADDRESS Integrator account ###########
    integrator_fee_account = ZERO_ADDRESS
    
    template_id = auction_factory.getTemplateId(crowdsale_template)
    before_deploy_balance_miso_dev = miso_dev.balance()
    tx = auction_factory.deployMarket(template_id,integrator_fee_account,{"from":accounts[0],"value":ETH_FOR_FEE})
    assert "MarketCreated" in tx.events
    after_deploy_balance_miso_dev = miso_dev.balance()
    assert after_deploy_balance_miso_dev - before_deploy_balance_miso_dev == 1 * TENPOW18
    ########## Checking Miso Dev Integrator account ###############
    integrator_fee_account = miso_dev
    
    template_id = auction_factory.getTemplateId(crowdsale_template)
    before_deploy_balance_miso_dev = miso_dev.balance()
    tx = auction_factory.deployMarket(template_id,integrator_fee_account,{"from":accounts[0],"value":ETH_FOR_FEE})
    assert "MarketCreated" in tx.events
    after_deploy_balance_miso_dev = miso_dev.balance()
    assert after_deploy_balance_miso_dev - before_deploy_balance_miso_dev == 1 * TENPOW18


def test_market_wrong_operator_add_template(auction_factory,crowdsale_template_2):
    with reverts():
        auction_factory.addAuctionTemplate(crowdsale_template_2,{"from":accounts[9]})

def test_market_set_minimum_fee_with_wrong_operator(auction_factory):
    minimum_fee = 0.1 * TENPOW18
    with reverts():
        auction_factory.setMinimumFee(minimum_fee, {"from":accounts[9]})

def test_market_set_integrator_pct_wrong_operator(auction_factory):
    integrator_fee_percent = 10
    with reverts("MISOMarket: Sender must be operator"):
        auction_factory.setIntegratorFeePct(integrator_fee_percent, {"from":accounts[9]})

def test_market_set_integrator_pct_not_in_range(auction_factory):
    integrator_fee_percent = 2000
    with reverts("MISOMarket: Percentage is out of 1000"):
        auction_factory.setIntegratorFeePct(integrator_fee_percent, {"from":accounts[0]})
    

def test_market_remove_farm_template_not_operator(auction_factory):
    with reverts("MISOMarket: Sender must be operator"):
        auction_factory.removeAuctionTemplate(1, {"from":accounts[5]})

def test_market_set_dividends_not_operator(auction_factory):
    miso_dev = accounts[5]
    with reverts():
        auction_factory.setDividends(miso_dev,{"from":accounts[5]})

def test_market_init_again(auction_factory,bento_box,miso_access_controls,dutch_auction_template):
    with reverts():
        auction_factory.initMISOMarket(miso_access_controls,bento_box, [dutch_auction_template], {'from': accounts[0]})



