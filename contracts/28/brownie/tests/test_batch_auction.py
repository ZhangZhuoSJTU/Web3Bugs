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

def test_batch_auction_commitEth(batch_auction):
    token_buyer =  accounts[2]
    eth_to_transfer = 20 * TENPOW18
    assert batch_auction.tokenPrice() == 0

    # tx = token_buyer.transfer(batch_auction, eth_to_transfer)
    tx= batch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})

    assert 'AddedCommitment' in tx.events
    minimum_commitments_total = batch_auction.marketStatus()[0]
    assert minimum_commitments_total == eth_to_transfer
    assert batch_auction.tokenPrice() == eth_to_transfer / AUCTION_TOKENS * TENPOW18


def test_batch_auction_add_commitment_outside_hours(batch_auction):
    token_buyer =  accounts[2]
    eth_to_transfer = 20 * TENPOW18
    chain.sleep(AUCTION_TIME + 100)
    chain.mine()
    with reverts("BatchAuction: outside auction hours"):
        tx = batch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    
def test_batch_auction_tokensClaimable(batch_auction):
    token_buyer =  accounts[2]
    eth_to_transfer = 20 * TENPOW18
    tx= batch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
    assert batch_auction.tokensClaimable(accounts[2]) == AUCTION_TOKENS


def test_batch_auction_twoPurchases(batch_auction):
    assert batch_auction.tokensClaimable(accounts[2]) == 0
    token_buyer_a=  accounts[2]
    token_buyer_b =  accounts[3]

    eth_to_transfer_a = 20 * TENPOW18
    eth_to_transfer_b = 80 * TENPOW18
    # tx = token_buyer_a.transfer(batch_auction, eth_to_transfer_a)
    tx= batch_auction.commitEth(token_buyer_a, True, {"from": token_buyer_a, "value":eth_to_transfer_a})

    assert 'AddedCommitment' in tx.events
    tx= batch_auction.commitEth(token_buyer_b, True, {"from": token_buyer_b, "value":eth_to_transfer_b})

    assert 'AddedCommitment' in tx.events

    assert batch_auction.tokenPrice() == (eth_to_transfer_a + eth_to_transfer_b) / AUCTION_TOKENS * TENPOW18


def test_batch_auction_ended(batch_auction):

    assert batch_auction.auctionEnded({'from': accounts[0]}) == False
    chain.sleep(AUCTION_TIME)
    chain.mine()
    assert batch_auction.auctionEnded({'from': accounts[0]}) == True


####### ABI Encoded Form Test  ######################

@pytest.fixture(scope='function')
def batch_auction_init(BatchAuction):
    batch_auction_init = BatchAuction.deploy({"from":accounts[0]})
    return batch_auction_init

@pytest.fixture(scope='function')
def batch_auction_token_2(FixedToken):
    batch_auction_token_2 = FixedToken.deploy({'from': accounts[0]})
    name = "Batch Auction Token"
    symbol = "BAT"
    owner = accounts[0]

    batch_auction_token_2.initToken(name, symbol, owner,AUCTION_TOKENS, {'from': owner})

    return batch_auction_token_2

@pytest.fixture(scope='function')
def init_market_abi(batch_auction_init,batch_auction_token_2):
    assert batch_auction_token_2.balanceOf(accounts[0]) == AUCTION_TOKENS
    
    start_time = chain.time() +10
    end_time = start_time + AUCTION_TIME
    wallet = accounts[1]
    admin = accounts[0]
    batch_auction_token_2.approve(batch_auction_init, AUCTION_TOKENS, {"from": accounts[0]})

    _data = batch_auction_init.getBatchAuctionInitData(
        accounts[0],
        batch_auction_token_2,
        AUCTION_TOKENS,
        start_time,
        end_time,
        ETH_ADDRESS,
        AUCTION_MINIMUM_COMMITMENT,
        admin,
        ZERO_ADDRESS,
        wallet,
        {"from": accounts[0]}
    )
    
    batch_auction_init.initMarket(_data, {"from":accounts[0]})
    chain.sleep(10)
    return batch_auction_init 


def test_finalize_abi_batch_auction(init_market_abi,batch_auction_init,batch_auction_token_2):
    token_buyer = accounts[2]
    eth_to_transfer = 100 * TENPOW18
    batch_token_before_withdraw = batch_auction_token_2.balanceOf(token_buyer)
  #  assert batch_auction_init.operator() == accounts[0]
    
    with reverts("BatchAuction: Auction has not finished yet"): 
        batch_auction_init.finalize({"from":accounts[0]})
   
    with reverts("BatchAuction: Value must be higher than 0"):
        batch_auction_init.commitEth(token_buyer, True, {"from":token_buyer, "value": 0})

    with reverts("BatchAuction: Sender must be admin"): 
        batch_auction_init.finalize({"from":accounts[9]})

    with reverts("BatchAuction: Payment currency is not a token"):
        batch_auction_init.commitTokens(eth_to_transfer, True, {"from":token_buyer})

    # token_buyer.transfer(batch_auction_init, eth_to_transfer)
    tx= batch_auction_init.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})

    finalized = batch_auction_init.marketStatus()[3]

    assert finalized == False

    assert batch_auction_init.auctionSuccessful({"from":accounts[0]}) == True

    chain.sleep(AUCTION_TIME+100)
    chain.mine()
    batch_auction_init.finalize({"from":accounts[0]})
    
    with reverts("BatchAuction: Auction has already finalized"): 
        batch_auction_init.finalize({"from":accounts[0]})

    batch_auction_init.withdrawTokens({"from":token_buyer})
    
    batch_token_after_withdraw = batch_auction_token_2.balanceOf(token_buyer)
    ######### Total auction tokens as there is only one buy #########
    assert batch_token_after_withdraw - batch_token_before_withdraw == AUCTION_TOKENS


############ Finalize Auction ###############
def test_finalize_batch_auction_successful(batch_auction,batch_auction_token):
    
    
    token_buyer = accounts[2]
    eth_to_transfer = 100 * TENPOW18
   
    with reverts("BatchAuction: Auction has not finished yet"): 
        batch_auction.finalize({"from":accounts[0]})
   
    with reverts("BatchAuction: Value must be higher than 0"):
        batch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":0})

    with reverts("BatchAuction: Sender must be admin"): 
        batch_auction.finalize({"from":accounts[9]})

    with reverts("BatchAuction: Payment currency is not a token"):
        batch_auction.commitTokens(eth_to_transfer, True, {"from":token_buyer})

    batch_auction.commitEth(token_buyer, True, {"from":token_buyer, "value": eth_to_transfer})

    finalized = batch_auction.marketStatus()[3]
    
    assert finalized == False
    assert batch_auction.auctionSuccessful({"from":accounts[0]}) == True

    chain.sleep(AUCTION_TIME+100)
    chain.mine()
    batch_auction.finalize({"from":accounts[0]})
    
    with reverts("BatchAuction: Auction has already finalized"): 
        batch_auction.finalize({"from":accounts[0]})

    batch_token_before_withdraw = batch_auction_token.balanceOf(token_buyer)


    batch_auction.withdrawTokens({"from":token_buyer})

    batch_token_after_withdraw = batch_auction_token.balanceOf(token_buyer)
    ######### Total auction tokens as there is only one buy #########
    assert batch_token_after_withdraw - batch_token_before_withdraw == AUCTION_TOKENS

    assert batch_auction.tokensClaimable(accounts[8]) == 0
    with reverts("BatchAuction: No tokens to claim"):
        batch_auction.withdrawTokens(token_buyer,{"from":token_buyer})

def test_finalize_batch_auction_unsuccessful(batch_auction,batch_auction_token):
    token_buyer = accounts[2]
    eth_to_transfer = 2 * TENPOW18
    batch_token_before_withdraw = batch_auction_token.balanceOf(token_buyer)

    batch_auction.commitEth(token_buyer, True, {"from":token_buyer, "value": eth_to_transfer})

    wallet = accounts[1]
    
    finalized = batch_auction.marketStatus()[3]

    assert finalized == False
    assert batch_auction.auctionSuccessful({"from":accounts[0]}) == False

    chain.sleep(AUCTION_TIME+100)
    chain.mine()
    batch_auction.finalize({"from":accounts[0]})

    assert  batch_auction_token.balanceOf(wallet) == AUCTION_TOKENS

    batch_auction.withdrawTokens({"from":token_buyer})
    batch_token_after_withdraw = batch_auction_token.balanceOf(token_buyer)

    assert batch_token_after_withdraw - batch_token_before_withdraw == 0


######## Test to commit with tokens   ###########################
#### fixed_token_cal -> token to auction
#### fixed_token_payment_currency -> token to pay by

def test_batch_auction_commit_tokens(batch_auction_pay_by_token, fixed_token_payment_currency): 
    account_payer = accounts[6] 
    fixed_token_payment_currency.approve(accounts[5], 50*TENPOW18, {"from": accounts[5]})

    fixed_token_payment_currency.transferFrom(accounts[5], account_payer, 20*TENPOW18,{"from":accounts[5]})
    
    assert fixed_token_payment_currency.balanceOf(account_payer) == 20 * TENPOW18
    
    fixed_token_payment_currency.approve(batch_auction_pay_by_token, 20 * TENPOW18,{"from":account_payer})
    batch_auction_pay_by_token.commitTokens(5 * TENPOW18, True, {"from":account_payer})

    assert fixed_token_payment_currency.balanceOf(batch_auction_pay_by_token) ==  5 * TENPOW18   
    with reverts("BatchAuction: Value must be higher than 0"):
        batch_auction_pay_by_token.commitTokens(0 * TENPOW18, True, {"from":account_payer})

    assert fixed_token_payment_currency.balanceOf(batch_auction_pay_by_token) ==  5 * TENPOW18   

    token_buyer = accounts[5]
    with reverts("BatchAuction: payment currency is not ETH"):
        eth_to_transfer = 20 * TENPOW18
        batch_auction_pay_by_token.commitEth(token_buyer, True, {"from":token_buyer, "value": eth_to_transfer})




################# Helper Test Function To pay By Tokens #############################
@pytest.fixture(scope='function', autouse=True)
def batch_auction_pay_by_token(BatchAuction,fixed_token_payment_currency, fixed_token_cal):    
    funder = accounts[5]
    start_time = chain.time() + 10
    end_time = start_time + AUCTION_TIME
    wallet = accounts[1]
    batch_auction_pay_by_token = BatchAuction.deploy({"from": accounts[0]})
    auction_tokens = 100 * TENPOW18
    fixed_token_cal.approve(batch_auction_pay_by_token, auction_tokens, {"from": funder})
    
    start_time = chain.time() + 10
    end_time = start_time - 10
    
    with reverts("BatchAuction: end time must be older than start time"):
        batch_auction_pay_by_token.initAuction(
        funder,
        fixed_token_cal,
        auction_tokens,
        start_time,
        end_time,
        fixed_token_payment_currency,
        AUCTION_MINIMUM_COMMITMENT,
        accounts[0],
        ZERO_ADDRESS,
        wallet,
        {"from": accounts[0]}
    )

    start_time = chain.time() + 10
    end_time = start_time + AUCTION_TIME
    batch_auction_pay_by_token.initAuction(
        funder,
        fixed_token_cal,
        auction_tokens,
        start_time,
        end_time,
        fixed_token_payment_currency,
        AUCTION_MINIMUM_COMMITMENT,
        accounts[0],
        ZERO_ADDRESS, 
        wallet,
        {"from": accounts[0]}
    )
    with reverts("Already initialised"):
        batch_auction_pay_by_token.initAuction(
        funder,
        fixed_token_cal,
        auction_tokens,
        start_time,
        end_time,
        fixed_token_payment_currency,
        AUCTION_MINIMUM_COMMITMENT,
        accounts[0],
        ZERO_ADDRESS, 
        wallet,
        {"from": accounts[0]}
    )

    chain.sleep(10)
    return batch_auction_pay_by_token 



@pytest.fixture(scope='function', autouse=True)
def fixed_token_payment_currency(FixedToken):
    fixed_token_payment_currency = FixedToken.deploy({'from': accounts[5]})
    name = "Fixed Token IME"
    symbol = "IME"
    owner = accounts[5]

    fixed_token_payment_currency.initToken(name, symbol, owner,150*TENPOW18, {'from': owner})

    return fixed_token_payment_currency 



################# Helper  Test Function #############################
@pytest.fixture(scope='function', autouse=True)
def fixed_token_cal(FixedToken):
    fixed_token_cal = FixedToken.deploy({'from': accounts[5]})
    name = "Fixed Token Cal"
    symbol = "CAL"
    owner = accounts[5]

    fixed_token_cal.initToken(name, symbol, owner, 250*TENPOW18, {'from': owner})

    return fixed_token_cal


# def test_dutch_auction_claim(dutch_auction):
#     token_buyer = accounts[2]
#     eth_to_transfer = 100 * TENPOW18

#     with reverts():
#         dutch_auction.withdrawTokens({'from': accounts[0]})
    
#     dutch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
#     assert dutch_auction.finalised({'from': accounts[0]}) == False

#     chain.sleep(AUCTION_TIME+100)
#     chain.mine()
#     assert dutch_auction.auctionSuccessful({'from': accounts[0]}) == True

#     dutch_auction.withdrawTokens({'from': token_buyer})

#     # Check for multiple withdraws
#     with reverts():
#         dutch_auction.withdrawTokens({'from': token_buyer})
#         dutch_auction.withdrawTokens({'from': accounts[0]})

#     dutch_auction.finaliseAuction({'from': accounts[0]})
#     with reverts():
#         dutch_auction.finaliseAuction({'from': accounts[0]})

# def test_dutch_auction_claim_not_enough(dutch_auction):
#     token_buyer = accounts[2]
#     eth_to_transfer = 0.01 * TENPOW18

#     dutch_auction.commitEth(token_buyer, True, {"from": token_buyer, "value":eth_to_transfer})
#     chain.sleep(AUCTION_TIME+100)
#     chain.mine()
#     dutch_auction.withdrawTokens({'from': token_buyer})
#     dutch_auction.finaliseAuction({"from": accounts[0]})

# def test_dutch_auction_clearingPrice(dutch_auction):
#     chain.sleep(100)
#     chain.mine()
#     assert dutch_auction.clearingPrice() <= AUCTION_START_PRICE
#     assert dutch_auction.clearingPrice() > AUCTION_RESERVE

#     chain.sleep(AUCTION_TIME)
#     chain.mine()
#     assert dutch_auction.clearingPrice() == AUCTION_RESERVE


# ############### Commit Eth Test ###############################

# def test_dutch_auction_commit_eth(dutch_auction_cal):
#     assert dutch_auction_cal.tokensClaimable(accounts[2]) == 0
#     token_buyer_a=  accounts[2]
#     token_buyer_b =  accounts[3]

#     tx = token_buyer_a.transfer(dutch_auction_cal, 20 * TENPOW18)
#     assert 'AddedCommitment' in tx.events
    
#     tx = token_buyer_b.transfer(dutch_auction_cal, 90 * TENPOW18)
#     assert 'AddedCommitment' in tx.events
#     #### Initial balance of token_buyer_b = 100. Then transfer 90 but
#     #### only 80 can be transfered as max is 100.
#     #### 100 - 80 = 20
#     assert round(token_buyer_b.balance()/TENPOW18) == 20

# ############## Calculate Commitment test ######################
# def test_dutch_auction_calculate_commitment(dutch_auction_cal):
#     assert dutch_auction_cal.tokensClaimable(accounts[2]) == 0
#     token_buyer_a=  accounts[2]
#     token_buyer_b =  accounts[3]
    
#     tx = token_buyer_a.transfer(dutch_auction_cal, 20 * TENPOW18)
#     assert 'AddedCommitment' in tx.events
#     tx = token_buyer_b.transfer(dutch_auction_cal, 70 * TENPOW18)
#     assert 'AddedCommitment' in tx.events
#     commitment_not_max = dutch_auction_cal.calculateCommitment(5*TENPOW18, {"from":accounts[4]})
#     assert round(commitment_not_max/TENPOW18) == 5
    
#     commitment_more_than_max = dutch_auction_cal.calculateCommitment(30*TENPOW18, {"from":accounts[4]})
#     assert round(commitment_more_than_max/TENPOW18) == 10

# ################# Helper Test Function  #############################

# @pytest.fixture(scope='function', autouse=True)
# def dutch_auction_cal(DutchAuction, fixed_token_cal):
#     start_price = 1 * TENPOW18
#     auction_tokens = 100 * TENPOW18
    
#     start_date = chain.time() + 10
#     end_date = start_date + AUCTION_TIME
#     wallet = accounts[1]
#     dutch_auction_cal = DutchAuction.deploy({"from": accounts[5]})

#     fixed_token_cal.approve(dutch_auction_cal, auction_tokens, {"from": accounts[5]})

#     dutch_auction_cal.initAuction(accounts[5], fixed_token_cal, auction_tokens, start_date, end_date, ETH_ADDRESS, start_price, AUCTION_RESERVE, operator, ZERO_ADDRESS, wallet, {"from": accounts[5]})
#     assert dutch_auction_cal.clearingPrice() == start_price
#     chain.sleep(10)
#     return dutch_auction_cal 

# ################# Helper  Test Function #############################
# @pytest.fixture(scope='function', autouse=True)
# def fixed_token_cal(FixedToken):
#     fixed_token_cal = FixedToken.deploy({'from': accounts[5]})
#     name = "Fixed Token Cal"
#     symbol = "CAL"
#     owner = accounts[5]

#     fixed_token_cal.initToken(name, symbol, owner, {'from': owner})


#     fixed_token_cal.initFixedTotalSupply(250*TENPOW18, {'from': owner})
#     return fixed_token_cal


# ######## Test to commit with tokens   ###########################
# #### fixed_token_cal -> token to auction
# #### fixed_token_payment_currency -> token to pay by
# def test_dutch_auction_commit_tokens(dutch_auction_pay_by_token,fixed_token_payment_currency): 
#     account_payer = accounts[6] 
    
#     fixed_token_payment_currency.approve(accounts[5], 50*TENPOW18, {"from": accounts[5]})
#     fixed_token_payment_currency.transferFrom(accounts[5], account_payer, 20*TENPOW18,{"from":accounts[5]})
    
#     assert fixed_token_payment_currency.balanceOf(account_payer) == 20 * TENPOW18
    
#     fixed_token_payment_currency.approve(dutch_auction_pay_by_token, 20 * TENPOW18,{"from":account_payer})
#     dutch_auction_pay_by_token.commitTokens(5 * TENPOW18, True, {"from":account_payer})

#     assert fixed_token_payment_currency.balanceOf(dutch_auction_pay_by_token) ==  5 * TENPOW18   

    


# ################# Helper Test Function To pay By Tokens #############################

# @pytest.fixture(scope='function', autouse=True)
# def dutch_auction_pay_by_token(DutchAuction, fixed_token_payment_currency, fixed_token_cal):
#     start_price = 1 * TENPOW18
#     auction_tokens = 100 * TENPOW18
    
#     start_date = chain.time() + 10
#     end_date = start_date + AUCTION_TIME
#     wallet = accounts[1]
#     dutch_auction_pay_by_token = DutchAuction.deploy({"from": accounts[5]})

#     fixed_token_cal.approve(dutch_auction_pay_by_token, auction_tokens, {"from": accounts[5]})

#     dutch_auction_pay_by_token.initAuction(accounts[5], fixed_token_cal, auction_tokens, start_date, end_date, fixed_token_payment_currency, start_price, AUCTION_RESERVE, wallet, {"from": accounts[5]})
#     assert dutch_auction_pay_by_token.clearingPrice() == start_price
#     chain.sleep(10)
#     return dutch_auction_pay_by_token 

# ################# Helper Test Function To pay By Tokens #############################
# @pytest.fixture(scope='function', autouse=True)
# def fixed_token_payment_currency(FixedToken):
#     fixed_token_payment_currency = FixedToken.deploy({'from': accounts[5]})
#     name = "Fixed Token IME"
#     symbol = "IME"
#     owner = accounts[5]

#     fixed_token_payment_currency.initToken(name, symbol, owner, {'from': owner})


#     fixed_token_payment_currency.initFixedTotalSupply(150*TENPOW18, {'from': owner})
#     return fixed_token_payment_currency 



