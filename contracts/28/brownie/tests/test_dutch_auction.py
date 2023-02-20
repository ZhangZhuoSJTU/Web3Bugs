from brownie import accounts, web3, Wei, reverts, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
from brownie import Contract
from settings import *

# GP: What if the token is not minable during an auction? Should commit tokens to auction

# reset the chain after every test case
@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass



@pytest.fixture(scope='function')
def dutch_auction_helper(DutchAuction):
    dutch_auction_helper = DutchAuction.deploy({"from": accounts[0]})
    return dutch_auction_helper


@pytest.fixture(scope='function')
def dutch_auction_init_with_abi(DutchAuction):
    dutch_auction_init_with_abi = DutchAuction.deploy({"from": accounts[0]})
    return dutch_auction_init_with_abi

def test_dutch_auction_totalTokensCommitted(dutch_auction):
    assert dutch_auction.totalTokensCommitted() == 0

def test_dutch_auction_commitEth(dutch_auction):
    token_buyer =  accounts[2]
    eth_to_transfer = 20 * TENPOW18
    tx= dutch_auction.commitEth(token_buyer, True, {"from": accounts[0], "value":eth_to_transfer})
    # tx = dutch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    assert 'AddedCommitment' in tx.events
        

    with reverts("DutchAuction: Payment currency is not a token"):
        dutch_auction.commitTokens(20 * TENPOW18, True,  {"from": token_buyer})

def test_dutch_auction_tokensClaimable(dutch_auction):
    assert dutch_auction.tokensClaimable(accounts[2]) == 0
    token_buyer =  accounts[2]
    eth_to_transfer = 20 * TENPOW18
    dutch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    chain.sleep(AUCTION_TIME+100)
    chain.mine()
    assert dutch_auction.tokensClaimable(accounts[2]) == AUCTION_TOKENS

def test_dutch_auction_commitEth_with_abi_data(dutch_auction_init_with_abi, fixed_token2, dutch_auction_helper):

    assert fixed_token2.balanceOf(accounts[0]) == AUCTION_TOKENS
    
    start_time = chain.time() +10
    end_time = start_time + AUCTION_TIME
    wallet = accounts[1]
    operator = accounts[0]
    fixed_token2.approve(dutch_auction_init_with_abi, AUCTION_TOKENS, {"from": accounts[0]})
    _data = dutch_auction_init_with_abi.getAuctionInitData(
        accounts[0], 
        fixed_token2, 
        AUCTION_TOKENS, 
        start_time, 
        end_time, 
        ETH_ADDRESS,
        AUCTION_START_PRICE, 
        AUCTION_RESERVE, 
        operator, 
        ZERO_ADDRESS, 
        wallet)
    dutch_auction_init_with_abi.initMarket(_data)
    
    chain.sleep(10)
    token_buyer =  accounts[2]
    eth_to_transfer = 20 * TENPOW18

    tx = dutch_auction_init_with_abi.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    assert 'AddedCommitment' in tx.events

def test_dutch_auction_fail_init_tests(dutch_auction_init_with_abi,fixed_token2):
    assert fixed_token2.balanceOf(accounts[0]) == AUCTION_TOKENS
    operator = accounts[4]
   

    fixed_token2.approve(dutch_auction_init_with_abi, AUCTION_TOKENS, {"from": accounts[0]})
    
      
    ###################################################################
    start_time = chain.time() +10
    end_time = start_time - 100
    wallet = accounts[1]
    with reverts("DutchAuction: end time must be older than start price"):
        dutch_auction_init_with_abi.initAuction(accounts[0], fixed_token2, AUCTION_TOKENS, start_time, end_time, ETH_ADDRESS, AUCTION_START_PRICE, AUCTION_RESERVE,operator,ZERO_ADDRESS, wallet, {"from": accounts[0]})
    
    ####################################################################
    start_time = chain.time() +10
    end_time = start_time + AUCTION_TIME
  
    _Total_Tokens = 0
    with reverts("DutchAuction: total tokens must be greater than zero"):
        dutch_auction_init_with_abi.initAuction(accounts[0], fixed_token2, _Total_Tokens, start_time, end_time, ETH_ADDRESS, AUCTION_START_PRICE, AUCTION_RESERVE, operator,ZERO_ADDRESS, wallet, {"from": accounts[0]})
  
    #####################################################################

    start_price = AUCTION_START_PRICE
    minimum_price = start_price + 100

    with reverts("DutchAuction: start price must be higher than minimum price"):
        dutch_auction_init_with_abi.initAuction(accounts[0], fixed_token2, AUCTION_TOKENS, start_time, end_time, ETH_ADDRESS, start_price, minimum_price,operator,ZERO_ADDRESS, wallet, {"from": accounts[0]})
    
    #####################################################################
    minimum_price = 0

    with reverts("DutchAuction: minimum price must be greater than 0"):
        dutch_auction_init_with_abi.initAuction(accounts[0], fixed_token2, AUCTION_TOKENS, start_time, end_time, ETH_ADDRESS, start_price, minimum_price,operator,ZERO_ADDRESS, wallet, {"from": accounts[0]})
    #####################################################################

    dutch_auction_init_with_abi.initAuction(accounts[0], fixed_token2, AUCTION_TOKENS, start_time, end_time, ETH_ADDRESS, AUCTION_START_PRICE, AUCTION_RESERVE,operator,ZERO_ADDRESS, wallet, {"from": accounts[0]})
    assert dutch_auction_init_with_abi.clearingPrice() == AUCTION_START_PRICE
    chain.sleep(10)
    start_time = chain.time() +10
    end_time = start_time + AUCTION_TIME
    with reverts("Already initialised"):
        dutch_auction_init_with_abi.initAuction(accounts[0], fixed_token2, AUCTION_TOKENS, start_time, end_time, ETH_ADDRESS, AUCTION_START_PRICE, AUCTION_RESERVE,operator,ZERO_ADDRESS, wallet, {"from": accounts[0]})

def test_dutch_auction_twoPurchases(dutch_auction):
    assert dutch_auction.tokensClaimable(accounts[2]) == 0
    token_buyer_a=  accounts[2]
    token_buyer_b =  accounts[3]

    eth_to_transfer = 20 * TENPOW18
    tx = dutch_auction.commitEth(token_buyer_a, True, {"from": token_buyer_a, "value":eth_to_transfer})
    assert 'AddedCommitment' in tx.events
    tx = dutch_auction.commitEth(token_buyer_b, True, {"from": token_buyer_b, "value":80 * TENPOW18})
    assert 'AddedCommitment' in tx.events
    
def test_dutch_auction_after_auction_hours(dutch_auction):
    assert dutch_auction.tokensClaimable(accounts[2]) == 0
    
    chain.sleep(AUCTION_TIME + 24 *60*60)
    token_buyer_a=  accounts[2]

    eth_to_transfer = 20 * TENPOW18
    with reverts("DutchAuction: outside auction hours"):
        dutch_auction.commitEth(token_buyer_a, True, {"from": token_buyer_a, "value":eth_to_transfer})
    

def test_dutch_auction_before_auction_hours(dutch_auction):
    assert dutch_auction.tokensClaimable(accounts[2]) == 0
    
    chain.sleep(AUCTION_TIME + 24 *60*60)
    token_buyer_a=  accounts[2]

    eth_to_transfer = 20 * TENPOW18
    with reverts("DutchAuction: outside auction hours"):
        dutch_auction.commitEth(token_buyer_a, True, {"from": token_buyer_a, "value":eth_to_transfer})


def test_dutch_auction_tokenPrice(dutch_auction):
    assert dutch_auction.tokenPrice() == 0
    token_buyer=  accounts[2]
    eth_to_transfer = 20 * TENPOW18
    tx = dutch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    assert 'AddedCommitment' in tx.events
    assert dutch_auction.tokenPrice() == eth_to_transfer * TENPOW18 / AUCTION_TOKENS

def test_dutch_auction_ended(dutch_auction):

    assert dutch_auction.auctionEnded({'from': accounts[0]}) == False
    chain.sleep(AUCTION_TIME)
    chain.mine()
    assert dutch_auction.auctionEnded({'from': accounts[0]}) == True


def test_dutch_auction_claim(dutch_auction):
    token_buyer = accounts[2]
    eth_to_transfer = 100 * TENPOW18
    
    with reverts("DutchAuction: auction has not finished yet"):
        dutch_auction.withdrawTokens({'from': accounts[0]})
    
    dutch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    assert dutch_auction.finalized({'from': accounts[0]}) == False
    

    chain.sleep(AUCTION_TIME+1)
    chain.mine()
    assert dutch_auction.auctionSuccessful({'from': accounts[0]}) == True

    with reverts("DutchAuction: sender must be an admin"):
        dutch_auction.finalize({'from': accounts[8]})

    dutch_auction.finalize({'from': accounts[0]})
    
    dutch_auction.withdrawTokens({'from': token_buyer})

    # Check for multiple withdraws
    with reverts("DutchAuction: No tokens to claim"):
        dutch_auction.withdrawTokens({'from': token_buyer})
  
    with reverts("DutchAuction: auction already finalized"):
        dutch_auction.finalize({'from': accounts[0]})

def test_dutch_auction_auction_not_successful(dutch_auction):
    token_buyer = accounts[2]
    eth_to_transfer = 10 * TENPOW18
    
    dutch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    assert dutch_auction.finalized({'from': accounts[0]}) == False
    assert dutch_auction.auctionSuccessful({'from': accounts[0]}) == False
    chain.sleep(100)
    with reverts("DutchAuction: auction has not finished yet"):
        dutch_auction.finalize({'from': accounts[0]})

def test_dutch_auction_claim_not_enough(dutch_auction):
    token_buyer = accounts[2]
    eth_to_transfer = 0.01 * TENPOW18

    dutch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    chain.sleep(AUCTION_TIME+100)
    chain.mine()
    dutch_auction.finalize({"from": accounts[0]})
    dutch_auction.withdrawTokens({'from': token_buyer})

    with reverts("DutchAuction: auction already finalized"):
        dutch_auction.finalize({"from": accounts[0]})


def test_dutch_auction_clearingPrice(dutch_auction):
    chain.sleep(100)
    chain.mine()
    assert dutch_auction.clearingPrice() <= AUCTION_START_PRICE
    assert dutch_auction.clearingPrice() > AUCTION_RESERVE

    chain.sleep(AUCTION_TIME)
    chain.mine()
    assert dutch_auction.clearingPrice() == AUCTION_RESERVE


# ############### Commit Eth Test ###############################

# def test_dutch_auction_commit_eth(dutch_auction_cal_pool_eth):
#     assert dutch_auction_cal_pool_eth.tokensClaimable(accounts[2]) == 0
#     token_buyer_a=  accounts[2]
#     token_buyer_b =  accounts[3]

#     tx = dutch_auction_cal_pool_eth.commitEth(token_buyer_a, True, {"from": token_buyer_a, "value":20 * TENPOW18})
#     assert 'AddedCommitment' in tx.events
#     tx = dutch_auction_cal_pool_eth.commitEth(token_buyer_b, True, {"from": token_buyer_b, "value":90 * TENPOW18})
#     assert 'AddedCommitment' in tx.events
#     #### Initial balance of token_buyer_b = 100. Then transfer 90 but
#     #### only 80 can be transfered as max is 100.
#     #### 100 - 80 = 20
#     assert round(token_buyer_b.balance()/TENPOW18) == 20

#     ####### commiting eth beyond max ###########
#     tx = dutch_auction_cal_pool_eth.commitEth(token_buyer_b, True, {"from": token_buyer_b, "value":20 * TENPOW18})
#     assert round(token_buyer_b.balance()/TENPOW18) == 20


# ############## Calculate Commitment test ######################
# def test_dutch_auction_calculate_commitment(dutch_auction_cal_pool_eth):
#     assert dutch_auction_cal_pool_eth.tokensClaimable(accounts[2]) == 0
#     token_buyer_a=  accounts[2]
#     token_buyer_b =  accounts[3]
#     tx = dutch_auction_cal_pool_eth.commitEth(token_buyer_a, True, {"from": token_buyer_a, "value":20 * TENPOW18})
#     assert 'AddedCommitment' in tx.events
#     tx = dutch_auction_cal_pool_eth.commitEth(token_buyer_b, True, {"from": token_buyer_b, "value":70 * TENPOW18})
#     assert 'AddedCommitment' in tx.events
#     commitment_not_max = dutch_auction_cal_pool_eth.calculateCommitment(5*TENPOW18, {"from":accounts[4]})
#     assert round(commitment_not_max/TENPOW18) == 5
    
#     commitment_more_than_max = dutch_auction_cal_pool_eth.calculateCommitment(30*TENPOW18, {"from":accounts[4]})
#     assert round(commitment_more_than_max/TENPOW18) == 10




##########################################################
#### Test to commit with tokens   
#### fixed_token_cal -> token to auction
#### fixed_token_payment_currency -> token for payment currency
#############################################################
def test_dutch_auction_commit_tokens(dutch_auction_pay_by_token,fixed_token_payment_currency): 
    account_payer = accounts[6] 
    fixed_token_payment_currency.approve(accounts[5], 50*TENPOW18, {"from": accounts[5]})

    fixed_token_payment_currency.transferFrom(accounts[5], account_payer, 20*TENPOW18,{"from":accounts[5]})
    
    assert fixed_token_payment_currency.balanceOf(account_payer) == 20 * TENPOW18
    
    fixed_token_payment_currency.approve(dutch_auction_pay_by_token, 20 * TENPOW18,{"from":account_payer})
    dutch_auction_pay_by_token.commitTokens(5 * TENPOW18, True,  {"from":account_payer})

    assert fixed_token_payment_currency.balanceOf(dutch_auction_pay_by_token) ==  5 * TENPOW18   
    
    dutch_auction_pay_by_token.commitTokens(0 * TENPOW18, True,  {"from":account_payer})

    assert fixed_token_payment_currency.balanceOf(dutch_auction_pay_by_token) ==  5 * TENPOW18   

    token_buyer = accounts[5]
    with reverts("DutchAuction: payment currency is not ETH address"):
        eth_to_transfer = 20 * TENPOW18
        tx = dutch_auction_pay_by_token.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})






########################################
# Helper Test Function To pay By Tokens 
##########################################

@pytest.fixture(scope='function', autouse=True)
def dutch_auction_pay_by_token(DutchAuction, fixed_token_payment_currency, fixed_token_cal):
    start_price = 1 * TENPOW18
    auction_tokens = 100 * TENPOW18
    
    start_time = chain.time() + 10
    end_time = start_time + AUCTION_TIME
    wallet = accounts[1]
    operator = accounts[0]
    dutch_auction_pay_by_token = DutchAuction.deploy({"from": accounts[5]})

    fixed_token_cal.approve(
        dutch_auction_pay_by_token, 
        auction_tokens, {"from": accounts[5]})

    dutch_auction_pay_by_token.initAuction(
        accounts[5], 
        fixed_token_cal,
        auction_tokens, 
        start_time, 
        end_time, 
        fixed_token_payment_currency, 
        start_price, 
        AUCTION_RESERVE, 
        operator, 
        ZERO_ADDRESS, 
        wallet, 
        {"from": accounts[5]})
    assert dutch_auction_pay_by_token.clearingPrice() == start_price
    chain.sleep(10)
    return dutch_auction_pay_by_token 

######################################## 
# # Helper Test Function To pay By Tokens
########################################
@pytest.fixture(scope='function', autouse=True)
def fixed_token_payment_currency(FixedToken):
    fixed_token_payment_currency = FixedToken.deploy({'from': accounts[5]})
    name = "Fixed Token IME"
    symbol = "IME"
    owner = accounts[5]

    fixed_token_payment_currency.initToken(name, symbol, owner,150*TENPOW18, {'from': owner})

    return fixed_token_payment_currency 



###########################
#   Helper Function
###########################
# @pytest.fixture(scope='function', autouse=True)
# def dutch_auction_cal_pool_eth(DutchAuction, fixed_token_cal, _pool_liquidity_02_eth):
#     dutch_auction = _dutch_auction_cal(DutchAuction, fixed_token_cal, _pool_liquidity_02_eth)
#     return dutch_auction

def _dutch_auction_cal(DutchAuction, token_to_auction, payment_currency, _post_auction_launcher):
    start_price = 1 * TENPOW18
    auction_tokens = 100 * TENPOW18
    
    start_time = chain.time() + 10
    end_time = start_time + AUCTION_TIME
  
    operator = _post_auction_launcher
    wallet = _post_auction_launcher
    dutch_auction_cal = DutchAuction.deploy({"from": accounts[5]})

    token_to_auction.approve(dutch_auction_cal, auction_tokens, {"from": accounts[5]})

    dutch_auction_cal.initAuction(
        accounts[5], 
        token_to_auction, 
        auction_tokens, 
        start_time, 
        end_time, 
        payment_currency, 
        start_price, 
        AUCTION_RESERVE, 
        operator, 
        ZERO_ADDRESS,  
        wallet, {"from": accounts[5]})
    assert dutch_auction_cal.clearingPrice() == start_price

    
    chain.sleep(10)
    return dutch_auction_cal 


###########################
#   Helper Function
###########################
@pytest.fixture(scope='function', autouse=True)
def fixed_token_cal(FixedToken):
    fixed_token_cal = FixedToken.deploy({'from': accounts[5]})
    name = "Fixed Token Cal"
    symbol = "CAL"
    owner = accounts[5]

    fixed_token_cal.initToken(name, symbol, owner, 50000*TENPOW18, {'from': owner})

    return fixed_token_cal

# @pytest.fixture(scope='function')
# def _pool_liquidity_02_eth(PoolLiquidity02, public_access_controls, fixed_token_cal, weth_token, uniswap_factory):
#     isEth = True
#     pool_liquidity = _pool_liquidity_02_helper(PoolLiquidity02,isEth, public_access_controls,weth_token,fixed_token_cal,uniswap_factory)    
#     return pool_liquidity

# def _pool_liquidity_02_helper(PoolLiquidity02, isEth, public_access_controls, token_1, token_2, uniswap_factory):

#     deadline = chain.time() + POOL_LAUNCH_DEADLINE
#     launch_window = POOL_LAUNCH_WINDOW
#     locktime = POOL_LAUNCH_LOCKTIME
#     liquidity_percent = POOL_LIQUIDITY_PERCENT
#     is_token1_weth = isEth
#     pool_liquidity = PoolLiquidity02.deploy({"from": accounts[0]})
#     pool_liquidity.initPoolLiquidity(
#     token_1, token_2, uniswap_factory, 
#     accounts[0], accounts[0], liquidity_percent, deadline,locktime)

#     return pool_liquidity