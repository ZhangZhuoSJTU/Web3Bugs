from brownie import accounts, web3, Wei, reverts, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
from brownie import Contract
from settings import *
from test_dutch_auction import fixed_token_cal

@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass

@pytest.fixture(scope = 'function', autouse = True)
def post_auction_launcher_crowdsale(launcher_post_auction, crowdsale_eth,fixed_token_cal, uniswap_factory):
    post_auction_launcher = post_auction_launcher_helper(launcher_post_auction, crowdsale_eth, fixed_token_cal, uniswap_factory)
    
    return post_auction_launcher
    


def post_auction_launcher_helper(launcher_post_auction, auction_market, fixed_token_cal, uniswap_factory):
    _market = auction_market
    _factory = uniswap_factory
    _admin = accounts[0]
    _wallet = accounts[9]
    _liquidityPercent = 5000
    _locktime = POOL_LAUNCH_LOCKTIME
    token1 = fixed_token_cal
    fixed_token_cal_owner = accounts[5]
    token_to_approve = round(_market.getTotalTokens() * _liquidityPercent / 10000 + 100)
    token1.approve(launcher_post_auction,token_to_approve, {"from": fixed_token_cal_owner})
    
    launcher_post_auction.initAuctionLauncher(
        _market,
        _factory,
        _admin,
        _wallet,
        _liquidityPercent,
        _locktime,
        {"from": fixed_token_cal_owner}
    )    

    return launcher_post_auction

    
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


def test_post_auction_launcher_crowdsale(post_auction_launcher_crowdsale, weth_token, fixed_token_cal, crowdsale_eth):
    
    # deposit Token
    _deposit_token_2(post_auction_launcher_crowdsale,fixed_token_cal, 10 * TENPOW18, accounts[5])
    _deposit_token_2(post_auction_launcher_crowdsale,fixed_token_cal, 20 * TENPOW18, accounts[5])
    _deposit_token_2(post_auction_launcher_crowdsale,fixed_token_cal, 30 * TENPOW18, accounts[5])
    
    #depsit Eth
    _deposit_eth(post_auction_launcher_crowdsale, weth_token, 10 * TENPOW18, accounts[0])
    _deposit_eth(post_auction_launcher_crowdsale, weth_token, 15 * TENPOW18, accounts[2])
    _deposit_eth(post_auction_launcher_crowdsale, weth_token, 20 * TENPOW18, accounts[3])
    
    chain.sleep(POOL_LAUNCH_DEADLINE+10)
    
    assert post_auction_launcher_crowdsale.getToken1Balance()/TENPOW18 == (10 + 15 + 20)
    assert post_auction_launcher_crowdsale.getToken2Balance()/TENPOW18 == 2500 + 10 + 20 + 30
    _liquidityPercent = 5000
    
    token1Amount,token2Amount = post_auction_launcher_crowdsale.getTokenAmounts()
    print("return of getTokenAmounts function for token1 before launching: ", token1Amount/TENPOW18)
    print("return of getTokenAmounts function for token2 before launching ", token2Amount/TENPOW18)
   ## Check this:
    assert token1Amount/TENPOW18 ==  post_auction_launcher_crowdsale.getToken1Balance()/TENPOW18 * _liquidityPercent / 10000
    # This needs to be smarter
    # assert token2Amount/TENPOW18 ==  post_auction_launcher_crowdsale.getToken2Balance()/TENPOW18 * _liquidityPercent / 10000

    liquidity_generated = post_auction_launcher_crowdsale.finalize({"from":accounts[0]}).return_value
    print("liquidity generate: ", liquidity_generated/TENPOW18)
    assert liquidity_generated > 1 * TENPOW18
    
def test_withdraw_lp_tokens(UniswapV2Pair, post_auction_launcher_crowdsale, weth_token, fixed_token_cal, crowdsale_eth):
    
    post_auction_launcher_crowdsale = _finalizing_helper(post_auction_launcher_crowdsale, weth_token, fixed_token_cal, crowdsale_eth)
    liquidity_generated= post_auction_launcher_crowdsale.finalize({"from":accounts[0]}).return_value
    _admin = accounts[0]
    _wallet = accounts[9]
    chain.sleep(POOL_LAUNCH_LOCKTIME+10)
    token_pair = UniswapV2Pair.at(post_auction_launcher_crowdsale.tokenPair())
    post_auction_launcher_crowdsale.withdrawLPTokens({"from": _admin})
    assert token_pair.balanceOf(_wallet) == liquidity_generated

def test_withdraw_deposits(post_auction_launcher_crowdsale, weth_token, fixed_token_cal, crowdsale_eth):
    post_auction_launcher_crowdsale = _finalizing_helper(post_auction_launcher_crowdsale, weth_token, fixed_token_cal, crowdsale_eth)
    post_auction_launcher_crowdsale.finalize({"from":accounts[0]}).return_value
    _admin = accounts[0]
    _wallet = accounts[9]
    chain.sleep(POOL_LAUNCH_LOCKTIME+10)
    token1_balance_before_withdraw = post_auction_launcher_crowdsale.getToken1Balance()/TENPOW18
    token2_balance_before_withdraw = post_auction_launcher_crowdsale.getToken2Balance()/TENPOW18
    post_auction_launcher_crowdsale.withdrawDeposits({"from": _admin})
    token2 = fixed_token_cal
    token1 = weth_token
    assert (token1.balanceOf(_wallet)/TENPOW18 == token1_balance_before_withdraw)
    assert (token2.balanceOf(_wallet)/TENPOW18 == token2_balance_before_withdraw)


def _finalizing_helper( post_auction_launcher_crowdsale, weth_token, fixed_token_cal, crowdsale_eth):
     # deposit Token
    _deposit_token_2(post_auction_launcher_crowdsale,fixed_token_cal, 10 * TENPOW18, accounts[5])
    _deposit_token_2(post_auction_launcher_crowdsale,fixed_token_cal, 10 * TENPOW18, accounts[5])
    _deposit_token_2(post_auction_launcher_crowdsale,fixed_token_cal, 10 * TENPOW18, accounts[5])

    
    #depsit Eth
    _deposit_eth(post_auction_launcher_crowdsale, weth_token, 10 * TENPOW18, accounts[0])
    _deposit_eth(post_auction_launcher_crowdsale, weth_token, 10 * TENPOW18, accounts[2])
    _deposit_eth(post_auction_launcher_crowdsale, weth_token, 10 * TENPOW18, accounts[3])
    
    chain.sleep(POOL_LAUNCH_DEADLINE+10)

    return post_auction_launcher_crowdsale

def test_is_token_pair_created(post_auction_launcher_crowdsale, uniswap_factory):
    token1 = post_auction_launcher_crowdsale.token1()
    token2 = post_auction_launcher_crowdsale.token2()
    token_pair = post_auction_launcher_crowdsale.tokenPair()
    token_pair_from_factory = uniswap_factory.createPair(token1, token2).return_value
    assert token_pair == token_pair_from_factory

#################################
#Liquidity Launcher Test
#################################


@pytest.fixture(scope='function', autouse=True)
def post_auction_launcher_template_2(PostAuctionLauncher, weth_token):
    post_auction_launcher_template = PostAuctionLauncher.deploy(weth_token, {"from": accounts[0]})
    return post_auction_launcher_template

@pytest.fixture(scope='function', autouse = True)
def liquidity_launcher(MISOLauncher, miso_access_controls, post_auction_launcher_template, weth_token, bento_box):
    launcher = MISOLauncher.deploy({"from": accounts[0]})
    launcher.initMISOLauncher(miso_access_controls, weth_token, bento_box)
    launcher.setLocked(False, {'from': accounts[0]})

    assert launcher.accessControls() == miso_access_controls
    assert launcher.WETH() == weth_token
    launcher.addLiquidityLauncherTemplate(post_auction_launcher_template, {"from": accounts[0]} )

    return launcher

def test_create_launcher(liquidity_launcher,post_auction_launcher_template_2, crowdsale_eth_for_abi, fixed_token_cal, uniswap_factory):
    template_type = 3
    _template_id = liquidity_launcher.currentTemplateId(template_type)
    _token = fixed_token_cal
    _tokenSupply = 250 * TENPOW18 + 50 * TENPOW18
    fixed_token_cal_owner = accounts[5]
    _token.approve(liquidity_launcher, 250 * TENPOW18 + 100 * TENPOW18, {"from":fixed_token_cal_owner})
    integratorFeeAccount = accounts[6]
    
    _data = _get_init_data(post_auction_launcher_template_2, crowdsale_eth_for_abi,uniswap_factory)
    liquidity_launcher.createLauncher(_template_id, _token, _tokenSupply, integratorFeeAccount, _data, {"from":fixed_token_cal_owner})


def _get_init_data(launcher, auction_market, uniswap_factory):
    _market = auction_market
    _factory = uniswap_factory
    _admin = accounts[0]
    _wallet = accounts[9]
    _liquidityPercent = 500
    _locktime = POOL_LAUNCH_LOCKTIME
    fixed_token_cal_owner = accounts[5]
    
    _data = launcher.getLauncherInitData(
        _market,
        _factory,
        _admin,
        _wallet,
        _liquidityPercent,
        _locktime,
        {"from": fixed_token_cal_owner}
    )

    return _data
############################################
##### Helper Functions
############################################

@pytest.fixture(scope='function', autouse = True)
def crowdsale_eth(Crowdsale, fixed_token_cal, launcher_post_auction):
    operator = launcher_post_auction
    crowdsale = _crowdsale_helper(Crowdsale, fixed_token_cal, ETH_ADDRESS,operator)
    eth_to_transfer = 10 * TENPOW18
    crowdsale = _buy_tokens(crowdsale, accounts[1], eth_to_transfer)
    crowdsale = _buy_tokens(crowdsale, accounts[2], eth_to_transfer)
    crowdsale = _buy_tokens(crowdsale, accounts[3], eth_to_transfer)
    chain.sleep(CROWDSALE_TIME+100)
    
    return crowdsale

@pytest.fixture(scope='function', autouse = True)
def crowdsale_eth_for_abi(Crowdsale, fixed_token_cal, launcher_post_auction):
    operator = launcher_post_auction
    crowdsale = _crowdsale_helper(Crowdsale, fixed_token_cal, ETH_ADDRESS,operator)
    eth_to_transfer = 10 * TENPOW18
    crowdsale = _buy_tokens(crowdsale, accounts[1], eth_to_transfer)
    crowdsale = _buy_tokens(crowdsale, accounts[2], eth_to_transfer)
    crowdsale = _buy_tokens(crowdsale, accounts[3], eth_to_transfer)
    chain.sleep(CROWDSALE_TIME+100)
    
    return crowdsale

def _crowdsale_helper(Crowdsale,token_to_auction, token_for_payment, operator):
    crowdsale = Crowdsale.deploy({"from": accounts[0]})
    
    start_time = chain.time() + 10
    end_time = start_time + CROWDSALE_TIME
    wallet = operator
    operator = operator
    AUCTION_TOKENS = 5000 * TENPOW18
    _funder = accounts[5]
    token_to_auction.approve(crowdsale, AUCTION_TOKENS, {"from": accounts[5]})
    
    crowdsale.initCrowdsale(
        _funder,
        
        token_to_auction,
        token_for_payment,
        AUCTION_TOKENS,
        start_time,
        end_time,
        CROWDSALE_RATE_2,
        CROWDSALE_GOAL,
        operator,
        ZERO_ADDRESS,
        wallet,
        {"from": accounts[0]}
    )
    assert token_to_auction.balanceOf(crowdsale) == AUCTION_TOKENS
    chain.sleep(10)
    
    return crowdsale

def _buy_tokens(crowdsale,token_buyer,eth_to_transfer):
    
    crowdsale.commitEth(token_buyer, True, {"value": eth_to_transfer, "from": token_buyer})
    return crowdsale