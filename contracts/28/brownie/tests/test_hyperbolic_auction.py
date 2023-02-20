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





def test_hyperbolic_auction_commit_Eth(hyperbolic_auction):
    token_buyer = accounts[2]
    eth_to_transfer = 20 * TENPOW18

    tx = hyperbolic_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    assert 'AddedCommitment' in tx.events
    assert hyperbolic_auction.tokenPrice() == eth_to_transfer / AUCTION_TOKENS * TENPOW18

    assert hyperbolic_auction.marketStatus()[0] == eth_to_transfer

def test_hyperbolic_auction_tokens_claimable(hyperbolic_auction):
    token_buyer =  accounts[2]
    eth_to_transfer = 20 * TENPOW18
    hyperbolic_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    chain.sleep(AUCTION_TIME+100)
    chain.mine()
    assert hyperbolic_auction.tokensClaimable(accounts[2]) == AUCTION_TOKENS

def test_hyperbolic_auction_two_purchases(hyperbolic_auction):
    assert hyperbolic_auction.tokensClaimable(accounts[2]) == 0
    token_buyer_a =  accounts[2]
    token_buyer_b =  accounts[3]

    eth_to_transfer_a = 20 * TENPOW18
    eth_to_transfer_b = 80 * TENPOW18
    
    tx = hyperbolic_auction.commitEth(token_buyer_a, True, {"from": token_buyer_a, "value":eth_to_transfer_a})
    assert 'AddedCommitment' in tx.events
    tx = hyperbolic_auction.commitEth(token_buyer_a, True, {"from": token_buyer_a, "value":eth_to_transfer_a})
    assert 'AddedCommitment' in tx.events

def test_hyperbolic_auction_with_abi_data(HyperbolicAuction,fixed_token2):
    assert fixed_token2.balanceOf(accounts[0]) == AUCTION_TOKENS
    
    start_time = chain.time() +10
    end_time = start_time + AUCTION_TIME
    wallet = accounts[1]
    operator = accounts[0]
    hyperbolic_auction_init_with_abi = HyperbolicAuction.deploy({"from": accounts[0]})

    fixed_token2.approve(hyperbolic_auction_init_with_abi, AUCTION_TOKENS, {"from": accounts[0]})

    _data = hyperbolic_auction_init_with_abi.getAuctionInitData(
        accounts[0],
        fixed_token2,
        AUCTION_TOKENS,
        start_time,
        end_time,
        ETH_ADDRESS,
        HYPERBOLIC_AUCTION_FACTOR,
        AUCTION_RESERVE,
        operator,
        ZERO_ADDRESS,
        wallet,
        {"from": accounts[0]}
    )

    hyperbolic_auction_init_with_abi.initMarket(_data)
    chain.sleep(12)
    token_buyer =  accounts[2]
    eth_to_transfer = 20 * TENPOW18
    tx = hyperbolic_auction_init_with_abi.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    assert 'AddedCommitment' in tx.events
    return hyperbolic_auction_init_with_abi

def test_hyperbolic_auction_withdraw_tokens(hyperbolic_auction):
    token_buyer = accounts[2]
    eth_to_transfer = 100 * TENPOW18

    with reverts("HyperbolicAuction: auction has not finished yet"):
        hyperbolic_auction.withdrawTokens({'from':accounts[0]})

    hyperbolic_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    assert hyperbolic_auction.finalized({'from': accounts[0]}) == False

    chain.sleep(AUCTION_TIME+1)
    chain.mine()
    assert hyperbolic_auction.auctionSuccessful({'from': accounts[0]}) == True
    
    with reverts("HyperbolicAuction: not finalized"):
        hyperbolic_auction.withdrawTokens({'from':accounts[0]})
    
    with reverts("HyperbolicAuction: sender must be an admin"):
        hyperbolic_auction.finalize({'from':accounts[8]})
    
    

    hyperbolic_auction.finalize({'from':accounts[0]})
    assert hyperbolic_auction.finalized({'from': accounts[0]}) == True

    hyperbolic_auction.withdrawTokens({"from":token_buyer})

    with reverts("HyperbolicAuction: no tokens to claim"):
        hyperbolic_auction.withdrawTokens({"from":token_buyer})

    #with reverts("HyperbolicAuction: auction already finalized"):
     #   hyperbolic_auction.finalize({'from': accounts[0]})

    
def test_hyperbolic_auction_auction_not_successful(hyperbolic_auction):
    token_buyer = accounts[2]
    eth_to_transfer = 10 * TENPOW18

    hyperbolic_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})

    assert hyperbolic_auction.finalized({'from': accounts[0]}) == False
    assert hyperbolic_auction.auctionSuccessful({'from': accounts[0]}) == False

def test_hyperbolic_auction_commit_Eth_twice(hyperbolic_auction_cal):
    assert hyperbolic_auction_cal.tokensClaimable(accounts[2]) == 0
    token_buyer_a=  accounts[2]
    token_buyer_b =  accounts[5]
    chain.sleep(1)
    chain.mine()
    tx = hyperbolic_auction_cal.commitEth(token_buyer_a, True, {"from": token_buyer_a, "value":20 * TENPOW18})
    assert 'AddedCommitment' in tx.events
    tx = hyperbolic_auction_cal.commitEth(token_buyer_b, True, {"from": token_buyer_b, "value":90 * TENPOW18})
    assert 'AddedCommitment' in tx.events
    
    #### Initial balance of token_buyer_b = 100. Then transfer 90 but
    #### only 80 can be transfered as max is 100.
    #### 100 - 80 = 20
    ## GP: Not for hyperbolic, this needs to be recalced
    assert round(token_buyer_b.balance()/TENPOW18) == 10

    ####### commiting eth beyond max ###########
    tx = hyperbolic_auction_cal.commitEth(token_buyer_b, True, {"from": token_buyer_b, "value":10 * TENPOW18})
 


##########################################################
#### Test to commit with tokens   
#### fixed_token_cal -> token to auction
#### fixed_token_payment_currency -> token for payment currency
#############################################################
def test_hyperbolic_auction_commit_tokens(hyperbolic_auction_pay_by_token, fixed_token_payment_currency):
    account_payer = accounts[6]
    fixed_token_payment_currency.approve(accounts[0], 50*TENPOW18, {"from": accounts[0]})
    fixed_token_payment_currency.transferFrom(accounts[0], account_payer, 20*TENPOW18,{"from":accounts[0]})
    
    assert fixed_token_payment_currency.balanceOf(account_payer) == 20 * TENPOW18
    fixed_token_payment_currency.approve(hyperbolic_auction_pay_by_token, 20 * TENPOW18,{"from":account_payer})
    chain.sleep(1)
    chain.mine()
    hyperbolic_auction_pay_by_token.commitTokens(5* TENPOW18, True,  {"from":account_payer})
 
    assert fixed_token_payment_currency.balanceOf(hyperbolic_auction_pay_by_token) ==  5 * TENPOW18
    # with reverts():
    #     hyperbolic_auction_pay_by_token.commitTokens(0 * TENPOW18, True,  {"from":account_payer})

    assert fixed_token_payment_currency.balanceOf(hyperbolic_auction_pay_by_token) ==  5 * TENPOW18
    token_buyer = accounts[5]
    with reverts("HyperbolicAuction: payment currency is not ETH address"):
        eth_to_transfer = 20 * TENPOW18
        tx = hyperbolic_auction_pay_by_token.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})


###########################
#   Helper Function
###########################
@pytest.fixture(scope='function', autouse=True)
def hyperbolic_auction_cal(HyperbolicAuction, fixed_token_cal):
    auction_tokens = 100 * TENPOW18
    start_time = chain.time() +10
    end_time = start_time + AUCTION_TIME
    wallet = accounts[1]
    operator = accounts[0]
    hyperbolic_auction_cal = HyperbolicAuction.deploy({"from": accounts[0]})

    fixed_token_cal.approve(hyperbolic_auction_cal, auction_tokens, {"from": accounts[0]})

    hyperbolic_auction_cal.initAuction(
        accounts[0],
        fixed_token_cal,
        auction_tokens,
        start_time,
        end_time,
        ETH_ADDRESS,
        HYPERBOLIC_AUCTION_FACTOR,
        AUCTION_RESERVE,
        operator,
        ZERO_ADDRESS,
        wallet,
        {"from": accounts[0]}
    )
    chain.sleep(10)
    return hyperbolic_auction_cal


###########################
#   Helper Function
###########################
@pytest.fixture(scope='function', autouse=True)
def fixed_token_cal(FixedToken):
    fixed_token_cal = FixedToken.deploy({'from': accounts[5]})
    name = "Fixed Token Cal"
    symbol = "CAL"
    owner = accounts[0]

    fixed_token_cal.initToken(name, symbol, owner, 250*TENPOW18, {'from': owner})

    return fixed_token_cal


########################################
# Helper Test Function To pay By Tokens 
##########################################

@pytest.fixture(scope='function', autouse=True)
def hyperbolic_auction_pay_by_token(HyperbolicAuction, fixed_token_payment_currency, fixed_token_cal):
    start_price = 1 * TENPOW18
    auction_tokens = 100 * TENPOW18
    
    start_time = chain.time() + 10
    end_time = start_time + AUCTION_TIME
    wallet = accounts[1]
    operator = accounts[0]
    hyperbolic_auction_pay_by_token = HyperbolicAuction.deploy({"from": accounts[0]})

    fixed_token_cal.approve(
        hyperbolic_auction_pay_by_token, 
        auction_tokens, {"from": accounts[0]})

    hyperbolic_auction_pay_by_token.initAuction(
        accounts[0], 
        fixed_token_cal,
        auction_tokens, 
        start_time, 
        end_time, 
        fixed_token_payment_currency, 
        HYPERBOLIC_AUCTION_FACTOR, 
        AUCTION_RESERVE, 
        operator, 
        ZERO_ADDRESS, 
        wallet, 
        {"from": accounts[0]})
    chain.sleep(10)
    return hyperbolic_auction_pay_by_token 

######################################## 
# # Helper Test Function To pay By Tokens
########################################
@pytest.fixture(scope='function', autouse=True)
def fixed_token_payment_currency(FixedToken):
    fixed_token_payment_currency = FixedToken.deploy({'from': accounts[0]})
    name = "Fixed Token IME"
    symbol = "IME"
    owner = accounts[0]

    fixed_token_payment_currency.initToken(name, symbol, owner,150*TENPOW18, {'from': owner})

    return fixed_token_payment_currency 