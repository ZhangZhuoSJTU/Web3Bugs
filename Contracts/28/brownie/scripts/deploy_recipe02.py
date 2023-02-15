from brownie import *
from .settings import *
from .contracts import *
from .contract_addresses import *
import time


def main():
    load_accounts()

    # Initialise Project
    operator = accounts[0]
    wallet = accounts[1]

    # GP: Split into public and miso access control
    access_control = deploy_access_control(operator)
    user_access_control = deploy_user_access_control(operator)
    # user_access_control = access_control

    # Setup MISOTokenFactory
    miso_token_factory = deploy_miso_token_factory(access_control)
    mintable_token_template = deploy_mintable_token_template()
    if miso_token_factory.tokenTemplateId() == 0:
        miso_token_factory.addTokenTemplate(
            mintable_token_template, {'from': operator})

    # Setup MISO Market
    bento_box = deploy_bento_box()

    crowdsale_template = deploy_crowdsale_template()
    dutch_auction_template = deploy_dutch_auction_template()
    miso_market = deploy_miso_market(
        access_control, [dutch_auction_template, crowdsale_template])
    uniswap_factory = deploy_uniswap_factory()

    # MISOLauncher
    weth_token = deploy_weth_token()

    pool_liquidity_template = deploy_pool_liquidity_template()
    miso_launcher = deploy_miso_launcher(access_control, weth_token, bento_box)
    if miso_launcher.getLiquidityTemplateIndex(0) == ZERO_ADDRESS:
        miso_launcher.addLiquidityLauncherTemplate(
            pool_liquidity_template, {"from": accounts[0]})

    # MISOFarmFactory
    masterchef_template = deploy_masterchef_template()
    farm_factory = deploy_farm_factory(access_control)
    if farm_factory.farmTemplateId() == 0:
        farm_factory.addFarmTemplate(
            masterchef_template, {"from": accounts[0]})

    # Create mintable for testing
    recipe_02 = MISORecipe02.deploy(
        miso_token_factory,
        weth_token,
        miso_market,
        miso_launcher,
        uniswap_factory,
        farm_factory,
        {"from": accounts[0]}
    )

    # recipe_02_address = web3.toChecksumAddress(0x3FD2f53bA85345E17aF41e845f1c41014962db5F)
    # recipe_02 = MISORecipe02.at(recipe_02_address)

    # Access control admin must set the smart contract roles
    # user_access_control.addSmartContractRole(recipe_02, {'from': accounts[0]})

    name = "Token"
    symbol = "TKN"
    tokensToMint = 1000 * TENPOW18
    tokensToMarket = 200 * TENPOW18
    paymentCurrency = ETH_ADDRESS

    startTime = chain.time() + 50
    endTime = chain.time() + 1000
    market_rate = 100
    market_goal = 200

    launchwindow = 3 * 24 * 60 * 60
    deadline = 200
    locktime = 100
    tokensToLiquidity = 100 * TENPOW18

    # Create new Farm
    rewards_per_block = 1 * TENPOW18
    # Define the start time relative to sales
    start_block = len(chain) + 10
    dev_addr = wallet
    tokensToFarm = 100 * TENPOW18
    alloc_point = 10
    integratorFeeAccount = accounts[1]

    tx = recipe_02.prepareMiso(
        name,
        symbol,
        user_access_control,
        tokensToMint,
        tokensToMarket,
        paymentCurrency,

        startTime,
        endTime,
        market_rate,
        market_goal,
        wallet,
        operator,

        deadline,
        launchwindow,
        locktime,
        tokensToLiquidity,

        rewards_per_block,
        start_block,
        dev_addr,
        tokensToFarm,
        alloc_point,
        integratorFeeAccount, {'from': accounts[0]}
    )
    time.sleep(1)
    print("tx events: " + str(tx.events))
