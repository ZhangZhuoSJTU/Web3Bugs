from brownie import accounts, web3, Wei, reverts, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
from brownie import Contract
from settings import *
from test_dutch_auction import _dutch_auction_cal,fixed_token_cal

@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass

@pytest.fixture(scope='function', autouse=True)
def post_auction_launcher_template_2(PostAuctionLauncher, weth_token):
    post_auction_launcher_template = PostAuctionLauncher.deploy(weth_token, {"from": accounts[0]})
    return post_auction_launcher_template

@pytest.fixture(scope = 'function', autouse = True)
def post_auction_launcher_dutch_auction(post_auction_launcher_template, dutch_auction_cal_eth,fixed_token_cal, uniswap_factory):
    post_auction_launcher = post_auction_launcher_helper(post_auction_launcher_template, dutch_auction_cal_eth, fixed_token_cal, uniswap_factory)
    
    return post_auction_launcher

@pytest.fixture(scope = 'function', autouse = True)
def post_auction_launcher_dutch_auction_tokens(post_auction_launcher_template_2, dutch_auction_cal_tokens,fixed_token_cal, uniswap_factory):
    post_auction_launcher = post_auction_launcher_helper(post_auction_launcher_template_2, dutch_auction_cal_tokens, fixed_token_cal, uniswap_factory)
    
    return post_auction_launcher
    

def post_auction_launcher_helper(post_auction_launcher_template, auction_market, fixed_token_cal, uniswap_factory):
    _market = auction_market
    _factory = uniswap_factory
    _admin = accounts[0]
    _wallet = accounts[1]
    _liquidityPercent = 5000
    _locktime = POOL_LAUNCH_LOCKTIME
    token1 = fixed_token_cal

    token_to_approve = round(_market.getTotalTokens() * _liquidityPercent / 10000 + 100)
    token1.approve(post_auction_launcher_template,token_to_approve, {"from": accounts[5]})
    
    post_auction_launcher_template.initAuctionLauncher(
        _market,
        _factory,
        _admin,
        _wallet,
        _liquidityPercent,
        _locktime,
        {"from": accounts[5]}
    )    

    return post_auction_launcher_template

    
##############################
#### Pool Liquidity Launcher
##############################
def _deposit_eth(post_auction_launcher, weth_token, amount, depositor):
    post_auction_launcher.depositETH({"from": depositor, "value": amount})

def _deposit_token_1(post_auction_launcher, token, amount, depositor):
    token.approve(post_auction_launcher,amount,{"from": depositor})
    tx = post_auction_launcher.depositToken1(amount, {'from': depositor})

def _deposit_token_2(post_auction_launcher, token, amount, depositor):
    token.approve(post_auction_launcher,amount,{"from": depositor})
    tx = post_auction_launcher.depositToken2(amount, {'from': depositor})


def test_post_auction_launcher_dutch_auction(post_auction_launcher_dutch_auction, weth_token, fixed_token_cal, dutch_auction_cal_eth):
    token_to_deposit = 10 * TENPOW18
    _deposit_token_2(post_auction_launcher_dutch_auction,fixed_token_cal, token_to_deposit, accounts[5])

    _deposit_eth(post_auction_launcher_dutch_auction, weth_token, ETH_TO_DEPOSIT, accounts[0])
   
    chain.sleep(POOL_LAUNCH_DEADLINE+10)
    liquidity_generated = post_auction_launcher_dutch_auction.finalize({"from":accounts[0]}).return_value
    print("liquidity generate: ", liquidity_generated)
    assert liquidity_generated > 1

def test_post_auction_launcher_two_tokens(post_auction_launcher_dutch_auction_tokens, fixed_token2, fixed_token_cal, dutch_auction_cal_tokens):
    token_to_auction = fixed_token_cal
    payment_currency = fixed_token2
    #deposit payment currency
    _deposit_token_1(post_auction_launcher_dutch_auction_tokens, payment_currency, 10 * TENPOW18, accounts[0])
    _deposit_token_1(post_auction_launcher_dutch_auction_tokens, payment_currency, 10 * TENPOW18, accounts[0])
    _deposit_token_1(post_auction_launcher_dutch_auction_tokens, payment_currency, 10 * TENPOW18, accounts[0])

    #deposit token to auction

    _deposit_token_2(post_auction_launcher_dutch_auction_tokens, token_to_auction, 10 * TENPOW18, accounts[5])
        
    chain.sleep(POOL_LAUNCH_DEADLINE+10)

    liquidity_generated = post_auction_launcher_dutch_auction_tokens.finalize({"from":accounts[0]}).return_value
    assert liquidity_generated > 1 * TENPOW18

############################################
##### Helper Functions
############################################

@pytest.fixture(scope='function', autouse = True)
def dutch_auction_cal_eth(DutchAuction, fixed_token_cal, post_auction_launcher_template):
    token_to_auction = fixed_token_cal
    payment_currency = ETH_ADDRESS
    dutch_auction = _dutch_auction_cal(DutchAuction, token_to_auction, payment_currency, post_auction_launcher_template)
    token_buyer =  accounts[2]
    eth_to_transfer = 20 * TENPOW18
    dutch_auction = _dutch_auction_commit_eth(dutch_auction, token_buyer, eth_to_transfer)
    return dutch_auction

def _dutch_auction_commit_eth(dutch_auction, token_buyer,eth_to_transfer):
    dutch_auction.commitEth(token_buyer, True, {"from": accounts[0], "value":eth_to_transfer})
    return dutch_auction

@pytest.fixture(scope = 'function', autouse = True)
def dutch_auction_cal_tokens(DutchAuction, fixed_token_cal, post_auction_launcher_template_2, fixed_token2):
    token_to_auction = fixed_token_cal
    payment_currency = fixed_token2
    dutch_auction = _dutch_auction_cal(DutchAuction, token_to_auction, payment_currency, post_auction_launcher_template_2)
    dutch_auction = _dutch_auction_commit_token(payment_currency,dutch_auction, accounts[0], 20 * TENPOW18)
    return dutch_auction

def _dutch_auction_commit_token(payment_currency,dutch_auction, token_buyer,token_amount):
    payment_currency.approve(dutch_auction, token_amount, {"from": token_buyer})
    dutch_auction.commitTokens(token_amount, True, {"from":token_buyer})
    return dutch_auction