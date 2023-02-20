from brownie import accounts, web3, Wei, reverts, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
from brownie import Contract
from settings import *
from test_token_factory import _create_token

# reset the chain after every test case


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass

# Crowdsale with a simple operator


@pytest.fixture(scope='module', autouse=True)
def crowdsale(Crowdsale, mintable_token):
    crowdsale = Crowdsale.deploy({"from": accounts[0]})
    mintable_token.mint(accounts[0], AUCTION_TOKENS, {"from": accounts[0]})
    assert mintable_token.balanceOf(accounts[0]) == AUCTION_TOKENS

    start_time = chain.time() + 10
    end_time = start_time + CROWDSALE_TIME
    wallet = accounts[4]
    operator = accounts[0]

    mintable_token.approve(crowdsale, AUCTION_TOKENS, {"from": accounts[0]})
    crowdsale.initCrowdsale(
        accounts[0],
        mintable_token,
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
    assert mintable_token.balanceOf(crowdsale) == AUCTION_TOKENS
    chain.sleep(10)
    return crowdsale


@pytest.fixture(scope='function')
def miso_helper(MISOHelper, miso_access_controls, token_factory, auction_factory, launcher, farm_factory):
    miso_helper = MISOHelper.deploy(miso_access_controls, token_factory, auction_factory, launcher, farm_factory, {"from": accounts[0]})

    return miso_helper


def test_getTokens(miso_helper, token_factory, fixed_token_template):

    name = "Helper Token"
    symbol = "HP"
    template_id = 1  # Fixed Token Template
    total_supply = 100 * TENPOW18
    integrator_account = accounts[1]

    _create_token(
        token_factory,
        fixed_token_template,
        name,
        symbol,
        total_supply,
        template_id,
        integrator_account,
        accounts[0]
    )

    _create_token(
        token_factory,
        fixed_token_template,
        name,
        symbol,
        total_supply,
        template_id,
        integrator_account,
        accounts[1]
    )

    tokens = miso_helper.getTokens()
    print("tokens:", tokens)


def test_getCrowdsaleInfo(miso_helper, crowdsale):
    crowdsale_info = miso_helper.getCrowdsaleInfo(crowdsale)
    print("crowdsale_info:", crowdsale_info)
    print("totalTokens:", crowdsale.marketInfo()[2])


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

def test_getMarkets(miso_helper, auction_factory, dutch_auction_template, fixed_token_cal):

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
  
    markets = miso_helper.getMarkets()
    print("markets:", markets)
    

def test_getDutchAuctionInfo(miso_helper, dutch_auction):
    dutch_auction_info = miso_helper.getDutchAuctionInfo(dutch_auction)
    print("dutch_auction_info:", dutch_auction_info)


def test_getBatchAuctionInfo(miso_helper, batch_auction):
    batch_auction_info = miso_helper.getBatchAuctionInfo(batch_auction)
    print("batch_auction_info:", batch_auction_info)


def test_getHyperbolicAuctionInfo(miso_helper, hyperbolic_auction):
    hyperbolic_auction_info = miso_helper.getHyperbolicAuctionInfo(hyperbolic_auction)
    print("hyperbolic_auction_info:", hyperbolic_auction_info)

def test_getFarms(miso_helper, create_farm):
    farms = miso_helper.getFarms()

    print("farms:", farms)

def test_getFarmDetail(miso_helper, create_farm):
    farm_info_user_0 = miso_helper.getFarmDetail(create_farm, accounts[0])
    farm_info_user_1 = miso_helper.getFarmDetail(create_farm, accounts[1])

    print("farm_info_user_0:", farm_info_user_0)
    print("farm_info_user_1:", farm_info_user_1)

def test_getUserPoolsInfos(miso_helper):
    user_pool_infos = miso_helper.getUserPoolsInfos(accounts[0])

    print("user_pools_infos:", user_pool_infos)

def test_getUserMarketInfo(miso_helper, crowdsale):
    crowdsale.commitEth(accounts[0], True, {"from": accounts[0], "value": 2*TENPOW18})
    user_info = miso_helper.getUserMarketInfo(crowdsale, accounts[0])
    print("user_info:", user_info)
    
@pytest.fixture(scope='function')
def create_farm(MISOMasterChef, farm_factory, farm_template, fixed_token_cal, miso_access_controls, staking_token):
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

    data = farm_template.getInitData(fixed_token_cal, rewards_per_block, start_block, dev_addr, accounts[0])
    tx = farm_factory.createFarm(1,wallet, data,{"from":accounts[0]})
    master_chef = MISOMasterChef.at(tx.return_value)
    assert "FarmCreated" in tx.events
    assert farm_factory.numberOfFarms() == 1

    master_chef.addToken(150, staking_token, True, {'from': accounts[0]})

    staking_token.approve(master_chef, 100*TENPOW18, {'from': accounts[1]})
    master_chef.deposit(0, 100*TENPOW18, {'from': accounts[1]})
    staking_token.approve(master_chef, 200*TENPOW18, {'from': accounts[2]})
    master_chef.deposit(0, 200*TENPOW18, {'from': accounts[2]})

    assert master_chef.poolLength() == 1
    
    after_deploy_balance_miso_dev = miso_dev.balance()
    after_deploy_balance_integrator = integratorFeeAccount.balance()
    
    assert before_deploy_balance_miso_dev==after_deploy_balance_miso_dev
    assert before_deploy_balance_integrator == after_deploy_balance_integrator

    return master_chef


#####################################
# Reward Token
######################################

@pytest.fixture(scope='module', autouse=True)
def reward_token(FixedToken):
    reward_token = FixedToken.deploy({'from': accounts[0]})
    name = "Reward Token"
    symbol = "RWD"
    owner = accounts[1]
    initial_supply = 100000 * TENPOW18

    reward_token.initToken(name, symbol, owner, initial_supply, {'from': owner})

    return reward_token



#####################################
# Staking Token
######################################
@pytest.fixture(scope='module', autouse=True)
def staking_token(MintableToken):
    staking_token = MintableToken.deploy({'from': accounts[0]})

    name = "Staking Token"
    symbol = "STAKE"
    owner = accounts[0]

    staking_token.initToken(name, symbol, owner, 1000 * TENPOW18, {'from': owner})
    assert staking_token.name() == name
    assert staking_token.symbol() == symbol

    staking_token.mint(accounts[1], 1000 * TENPOW18, {'from': owner})
    assert staking_token.balanceOf(accounts[1]) == 1000 * TENPOW18 
    staking_token.mint(accounts[2], 200 * TENPOW18, {'from': owner})
    assert staking_token.balanceOf(accounts[2]) == 200 * TENPOW18 

    return staking_token


#####################################
# LP Token
######################################
@pytest.fixture(scope='module', autouse=True)
def lp_token(UniswapV2Pair, uniswap_factory, weth_token, reward_token):
    # lp_token = UniswapV2Pair.deploy({"from": accounts[0]})

    # lp_token.initialize(weth_token, reward_token, {"from": accounts[0]})
    tx = uniswap_factory.createPair(weth_token, reward_token, {"from": accounts[0]})

    lp_token = UniswapV2Pair.at(tx.return_value)

    weth_token.deposit({'from': accounts[1], 'value': 1 * TENPOW18})
    reward_token.transfer(lp_token, 100000 * TENPOW18, {'from':accounts[1]})
    weth_token.transfer(lp_token, 1 * TENPOW18, {'from':accounts[1]})
    lp_token.mint(accounts[1], {'from': accounts[1]})

    return lp_token

