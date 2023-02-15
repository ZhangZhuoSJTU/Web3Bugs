import pytest
from brownie import accounts, web3, Wei, reverts, chain
from brownie.convert import to_address
from settings import *
from test_crowdsale import _buy_token_helper
from test_token_factory import _create_token
# from test_recipe_02 import prepare_miso

# reset the chain after every test case


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


TOTAL_TOKENS_1 = 10000 * TENPOW18
TOTAL_TOKENS_2 = 100000 * TENPOW18
TOTAL_TOKENS_3 = 100000 * TENPOW18


@pytest.fixture(scope='module', autouse=True)
def token_1(FixedToken, token_factory, fixed_token_template):
    name = "Token 1"
    symbol = "TOKEN1"
    template_id = 1  # Fixed Token Template
    data = fixed_token_template.getInitData(
        name, symbol, accounts[0], TOTAL_TOKENS_1)
    integrator_account = accounts[1]
    tx = token_factory.createToken(template_id, integrator_account, data)
    assert "TokenCreated" in tx.events

    return FixedToken.at(tx.return_value)


@pytest.fixture(scope='module', autouse=True)
def crowdsale_1(Crowdsale, auction_factory, token_1):
    token_1.approve(auction_factory, TOTAL_TOKENS_1/2, {"from": accounts[0]})


# def prepare_miso(miso_recipe_02, miso_access_controls, owner):

#     operator = accounts[0]
#     wallet = accounts[1]
#     name = "Token"
#     symbol = "TKN"
#     tokensToMint = 1000 * TENPOW18
#     tokensToMarket = 200 * TENPOW18

#     startTime = chain.time() + 50
#     endTime = chain.time() + 1000
#     market_rate = 10 * TENPOW18
#     market_goal = 20 * TENPOW18
#     payment_currency = ETH_ADDRESS

#     duration = 300  # seconds
#     launchwindow = POOL_LAUNCH_WINDOW
#     deadline = chain.time() + POOL_LAUNCH_DEADLINE
#     locktime = POOL_LAUNCH_LOCKTIME
#     tokensToLiquidity = 100 * TENPOW18

#     # Create new Farm
#     rewards_per_block = 1 * TENPOW18
#     # Define the start time relative to sales
#     start_block = len(chain) + 10
#     dev_addr = wallet
#     tokensToFarm = 100 * TENPOW18
#     alloc_point = 10
#     integratorFeeAccount = accounts[1]

#     txn = miso_recipe_02.prepareMiso(
#         name,
#         symbol,
#         miso_access_controls,
#         tokensToMint,
#         tokensToMarket,
#         payment_currency,

#         startTime,
#         endTime,
#         market_rate,
#         market_goal,
#         wallet,
#         operator,


#         deadline,
#         launchwindow,
#         locktime,
#         tokensToLiquidity,

#         rewards_per_block,
#         start_block,
#         dev_addr,
#         tokensToFarm,
#         alloc_point,
#         integratorFeeAccount, {'from': owner}
#     )

#     token, crowdsale, lp_token, pool_liquidity, farm = txn.return_value
#     return [token, crowdsale, lp_token, pool_liquidity, farm]

# # def


# def test_prepare_miso(
#     FixedToken,
#     Crowdsale,
#     PoolLiquidity,
#     MISOMasterChef,
#     UniswapV2Pair,
#     token_factory,
#     fixed_token_template,
#     weth_token,
#     miso_recipe_02,
#     miso_access_controls
# ):
#     token_1, crowdsale_1, lp_token_1, pool_liquidity_1, farm_1 = prepare_miso(
#         miso_recipe_02, miso_access_controls, accounts[0])
    
#     token_1 = FixedToken.at(token_1)
#     crowdsale_1 = Crowdsale.at(crowdsale_1)
#     farm_1 = MISOMasterChef.at(farm_1)
#     lp_token_1 = UniswapV2Pair.at(lp_token_1)

#     # Crowdsale
#     assert token_1.balanceOf(crowdsale_1) == 200 * TENPOW18

#     buyer_1 = accounts[4]
#     amount_1 = 10 * TENPOW18
#     buyer_2 = accounts[2]
#     amount_2 = 5.5 * TENPOW18
#     buyer_3 = accounts[3]
#     amount_3 = 4.5 * TENPOW18

#     # assert token_1.balanceOf(pool_liquidity_1) == 100 * TENPOW18
#     # pool_liquidity_1 = PoolLiquidity.at(pool_liquidity_1)
#     # pool_liquidity_1.setAuction(crowdsale_1, {"from": accounts[0]})

#     chain.sleep(50)

#     crowdsale_1 = _buy_token_helper(crowdsale_1, buyer_1, amount_1)
#     crowdsale_1 = _buy_token_helper(crowdsale_1, buyer_2, amount_2)
#     crowdsale_1 = _buy_token_helper(crowdsale_1, buyer_3, amount_3)
#     assert crowdsale_1.auctionSuccessful() == True

#     # # Pool Liquidity

#     # chain.sleep(POOL_LAUNCH_DEADLINE)
#     # pool_liquidity_1.finalizeMarketAndLaunchLiquidityPool(
#     #     {"from": accounts[0]}
#     # )
#     # assert weth_token.balanceOf(lp_token_1) == amount_1 + amount_2 + amount_3
#     # assert token_1.balanceOf(lp_token_1) == 100 * TENPOW18
#     # assert crowdsale_1.balance() == 0

#     # chain.sleep(POOL_LAUNCH_LOCKTIME)

#     # lp_amount = pool_liquidity_1.withdrawLPTokens({'from': accounts[0]}).return_value

#     # lp_token_1.transfer(accounts[2], 10*TENPOW18, {'from': accounts[1]})
#     # lp_token_1.transfer(accounts[3], 10*TENPOW18, {'from': accounts[1]})
#     # lp_token_1.transfer(accounts[4], 10*TENPOW18, {'from': accounts[1]})

#     # # Farm

#     # lp_token_1.approve(farm_1, 10*TENPOW18, {'from': accounts[2]})
#     # lp_token_1.approve(farm_1, 10*TENPOW18, {'from': accounts[3]})
#     # lp_token_1.approve(farm_1, 10*TENPOW18, {'from': accounts[4]})

#     # farm_1.deposit(0, 10*TENPOW18, {'from': accounts[2]})
#     # farm_1.deposit(0, 10*TENPOW18, {'from': accounts[3]})
#     # farm_1.deposit(0, 10*TENPOW18, {'from': accounts[4]})
    

def test_dutch_auction(FixedToken, auction_factory, dutch_auction_template, fixed_token_template, token_factory):
    name = "Test Token"
    symbol = "TTOKEN"
    token_2 = _create_token(
        token_factory,
        fixed_token_template,
        name,
        symbol,
        TOTAL_TOKENS_2,
        1,
        accounts[2],
        accounts[2]
    )
    token_2 = FixedToken.at(token_2)
    assert token_2.balanceOf(accounts[2]) == TOTAL_TOKENS_2

    funder = accounts[2]
    tokens_to_market = 50000 * TENPOW18
    start_time = chain.time() + 50
    end_time = chain.time() + 1000
    start_price = 0.01 * TENPOW18
    minimum_price = 0.001 * TENPOW18
    operator = accounts[2]
    wallet = accounts[2]
    point_list = ZERO_ADDRESS
    payment_currency = ETH_ADDRESS

    data = dutch_auction_template.getAuctionInitData(
        auction_factory,
        token_2,
        tokens_to_market,
        start_time,
        end_time,
        payment_currency,
        start_price,
        minimum_price,
        operator,
        point_list,
        wallet
    )

    chain.sleep(10)

    token_2.approve(auction_factory, tokens_to_market, {"from": accounts[2]})

    template_id = auction_factory.getTemplateId(dutch_auction_template)

    tx = auction_factory.createMarket(
        template_id,
        token_2,
        tokens_to_market,
        accounts[2],
        data,
        {'from': accounts[2]}
    )

    assert "MarketCreated" in tx.events


