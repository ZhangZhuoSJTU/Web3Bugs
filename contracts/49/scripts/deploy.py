from brownie import *
from brownie import interface
from brownie import \
    UniswapV3FactoryMock, \
    OverlayV1Mothership, \
    OverlayV1OVLCollateral, \
    OverlayV1UniswapV3Market, \
    OverlayToken, \
    chain, \
    accounts
import os
import json


''' OVERLAY TOKEN PARAMETERS '''
TOKEN_TOTAL_SUPPLY = 8000000e18

''' OVERLAY QUANTO DAI/ETH MARKET PARAMETERS '''
AMOUNT_IN = 1e18
PRICE_WINDOW_MACRO = 3600
PRICE_WINDOW_MICRO = 600

K = 343454218783234
PRICE_FRAME_CAP = 5e18
SPREAD = .00573e18

UPDATE_PERIOD = 100
COMPOUND_PERIOD = 600

IMPACT_WINDOW = 600

LAMBDA = .6e18
STATIC_CAP = 370400e18
BRRRR_EXPECTED = 26320e18
BRRRR_WINDOW_MACRO = 2592000
BRRRR_WINDOW_MICRO = 86400

''' OVERLAY QUANTO DAI_ETH MARKET PARAMETERS ON OVL COLLATERAL MANAGER '''
MARGIN_MAINTENANCE = .06e18
MARGIN_REWARD_RATE = .5e18
MAX_LEVERAGE = 100

''' OVERLAY MOTHERSHIP PARAMETERS '''
FEE = .0015e18
FEE_BURN_RATE = .5e18
MARGIN_BURN_RATE = .5e18

''' GENERAL FEED PARAMETERS '''
DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
AXS = "0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b"
USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"

''' GENERAL ACCOUNTS '''
ALICE = accounts[2]
BOB = accounts[3]
FEED_OWNER = accounts[6]
GOV = accounts[0]
FEE_TO = accounts[4]


def deploy_uni_factory():

    uniswapv3_factory = FEED_OWNER.deploy(UniswapV3FactoryMock)

    return uniswapv3_factory


def deploy_uni_pool(factory, token0, token1, path):

    base = os.path.dirname(os.path.abspath(__file__))

    with open(os.path.normpath(os.path.join(base, path + '_raw_uni_framed.json'))) as f: 
        data = json.load(f)

    with open(os.path.normpath(os.path.join(base, path + '_reflected.json'))) as f: 
        beginning = json.load(f)['timestamp'][0]

    factory.createPool(token0, token1)

    IUniswapV3OracleMock = getattr(interface, 'IUniswapV3OracleMock')

    uniswapv3_pool = IUniswapV3OracleMock(factory.allPools(0))

    uniswapv3_pool.loadObservations(
        data['observations'],
        data['shims'],
        { 'from': FEED_OWNER }
    )

    chain.mine(timestamp=beginning)

    return uniswapv3_pool


def deploy_ovl():

    ovl = GOV.deploy(OverlayToken)
    ovl.mint(ALICE, TOKEN_TOTAL_SUPPLY / 2, { "from": GOV })
    ovl.mint(BOB, TOKEN_TOTAL_SUPPLY / 2, { "from": GOV })

    return ovl


def deploy_mothership(ovl):

    mothership = GOV.deploy(
        OverlayV1Mothership, 
        FEE_TO, 
        FEE, 
        FEE_BURN_RATE, 
        MARGIN_BURN_RATE
    )

    mothership.setOVL(ovl, { "from": GOV })

    ovl.grantRole(ovl.ADMIN_ROLE(), mothership, { "from": GOV })

    return mothership


def deploy_market(mothership, feed_depth, feed_market):

    market = GOV.deploy(
        OverlayV1UniswapV3Market,
        mothership,
        feed_depth,
        feed_market,
        WETH,
        WETH,
        AMOUNT_IN,
        PRICE_WINDOW_MACRO,
        PRICE_WINDOW_MICRO
    )

    market.setEverything(
        K,
        PRICE_FRAME_CAP,
        SPREAD,
        UPDATE_PERIOD,
        COMPOUND_PERIOD,
        IMPACT_WINDOW,
        LAMBDA,
        STATIC_CAP,
        BRRRR_EXPECTED,
        BRRRR_WINDOW_MACRO,
        BRRRR_WINDOW_MICRO,
        { "from": GOV }
    )

    mothership.initializeMarket(market, { "from": GOV })

    return market


def deploy_ovl_collateral(mothership, market, ovl):

    ovl_collateral = GOV.deploy(
        OverlayV1OVLCollateral,
        "uri",
        mothership
    )

    ovl_collateral.setMarketInfo(
        market,
        MARGIN_MAINTENANCE,
        MARGIN_REWARD_RATE,
        MAX_LEVERAGE,
        { "from": GOV }
    )

    market.addCollateral(ovl_collateral, { "from": GOV })

    mothership.initializeCollateral(ovl_collateral, { "from": GOV })

    ovl.approve(ovl_collateral, 1e50, { "from": ALICE })
    ovl.approve(ovl_collateral, 1e50, { "from": BOB })

    return ovl_collateral

def build_position (
    collateral_manager, 
    market, 
    collateral, 
    leverage, 
    is_long, 
    taker
):

    tx_build = collateral_manager.build(
        market,
        collateral,
        leverage,
        is_long,
        { "from": taker }
    )

    position = tx_build.events['Build']['positionId']
    oi = tx_build.events['Build']['oi']
    debt = tx_build.events['Build']['debt']
    collateral = oi - debt

    return {
        'market': market,
        'collateral_manager': collateral_manager,
        'id': position,
        'oi': oi,
        'collateral': collateral,
        'leverage': leverage,
        'is_long': is_long
    }

def unwind_position(
    collateral_manager,
    position_id,
    position_shares,
    unwinder
):

    tx_unwind = collateral_manager.unwind(
        position_id,
        position_shares,
        { "from": unwinder }
    )


def transfer_position_shares(
    collateral_manager,
    sender,
    receiver,
    position_id,
    amount
):

    tx_transfer = collateral_manager.safeTransferFrom(
        sender,
        receiver,
        position_id,
        amount,
        "",
        { "from": sender }
    )

def transfer_position_shares_batch(
    collateral_manager,
    sender,
    receiver,
    position_ids,
    amounts
):

    tx_transfer = collateral_manager.safeBatchTransferFrom(
        sender,
        receiver,
        position_ids,
        amounts,
        "",
        { "from": sender }
    )


def main():

    uni_factory = deploy_uni_factory()

    feed_depth = deploy_uni_pool(uni_factory, AXS, WETH, '../feeds/univ3_axs_weth')

    feed_market = deploy_uni_pool(uni_factory, DAI, WETH, '../feeds/univ3_dai_weth')

    ovl = deploy_ovl()

    mothership = deploy_mothership(ovl)

    market = deploy_market(mothership, feed_depth, feed_market)

    ovl_collateral = deploy_ovl_collateral(mothership, market, ovl)

    chain.mine( timedelta=market.compoundingPeriod() * 3 )

    position_1 = build_position(
        ovl_collateral,
        market,
        5e18,
        1,
        True,
        ALICE
    )

    chain.mine( timedelta=market.updatePeriod() * 2 )

    position_2 = build_position(
        ovl_collateral,
        market,
        5e18,
        5,
        False,
        ALICE
    )

    transfer_position_shares(
        ovl_collateral, 
        ALICE, 
        BOB, 
        position_1['id'], 
        position_1['oi'] / 2
    )

    unwind_position(
        ovl_collateral,
        position_1['id'],
        ovl_collateral.balanceOf(BOB, position_1['id']),
        BOB
    )

    unwind_position(
        ovl_collateral,
        position_1['id'],
        ovl_collateral.balanceOf(ALICE, position_1['id']),
        ALICE
    )

    chain.mine(timedelta=UPDATE_PERIOD)

    position_3 = build_position(
        ovl_collateral,
        market,
        5e18,
        1,
        True,
        ALICE
    )

    chain.mine(timedelta=UPDATE_PERIOD)

    position_4 = build_position(
        ovl_collateral,
        market,
        5e18,
        1,
        True,
        ALICE
    )

    chain.mine(timedelta=UPDATE_PERIOD)

    position_5 = build_position(
        ovl_collateral,
        market,
        5e18,
        1,
        True,
        ALICE
    )

    transfer_position_shares_batch(
        ovl_collateral, 
        ALICE, 
        BOB, 
        [ position_3['id'], position_4['id'], position_5['id'] ],
        [ position_3['oi'], position_4['oi'] / 2, position_5['oi'] / 4 ]
    )

    chain.mine(timedelta=UPDATE_PERIOD)

    position_6 = build_position(
        ovl_collateral,
        market,
        5e18,
        1,
        True,
        ALICE
    )

    chain.mine(timedelta=UPDATE_PERIOD)

    chain.mine(timedelta=COMPOUND_PERIOD)

    with open(".subgraph.test.env", "w") as f:
        f.write('OVL={}\n'.format(ovl))
        f.write('MOTHERSHIP={}\n'.format(mothership))
        f.write('MARKET={}\n'.format(market))
        f.write('OVL_COLLATERAL={}\n'.format(ovl_collateral))
        f.write('ALICE={}\n'.format(ALICE))
        f.write('BOB={}\n'.format(BOB))
        f.write('GOV={}\n'.format(GOV))
        f.write('FEE_TO={}\n'.format(FEE_TO))
        f.write('BOB_POSITION_1={}\n'.format(ovl_collateral.balanceOf(BOB, position_1['id'])))
        f.write('BOB_POSITION_2={}\n'.format(ovl_collateral.balanceOf(BOB, position_2['id'])))
        f.write('BOB_POSITION_3={}\n'.format(ovl_collateral.balanceOf(BOB, position_3['id'])))
        f.write('BOB_POSITION_4={}\n'.format(ovl_collateral.balanceOf(BOB, position_4['id'])))
        f.write('BOB_POSITION_5={}\n'.format(ovl_collateral.balanceOf(BOB, position_5['id'])))
        f.write('ALICE_POSITION_1={}\n'.format(ovl_collateral.balanceOf(ALICE, position_1['id'])))
        f.write('ALICE_POSITION_2={}\n'.format(ovl_collateral.balanceOf(ALICE, position_2['id'])))
        f.write('ALICE_POSITION_3={}\n'.format(ovl_collateral.balanceOf(ALICE, position_3['id'])))
        f.write('ALICE_POSITION_4={}\n'.format(ovl_collateral.balanceOf(ALICE, position_4['id'])))
        f.write('ALICE_POSITION_5={}\n'.format(ovl_collateral.balanceOf(ALICE, position_5['id'])))