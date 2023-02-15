from brownie import *
from .settings import *
from .contracts import *
from .contract_addresses import *
import time


def main():
    load_accounts()

    # Initialise Project
    deployer = accounts[0]
    admin = accounts[1]

    # When deployed, should the contracts be unlocked?
    unlock = True  

    #  miso access control
    access_control = deploy_access_control(deployer)
    if access_control.hasAdminRole(admin) == False:
        access_control.addAdminRole(admin, {'from': accounts[0]})

    if access_control.hasAdminRole(deployer) == False:
        access_control.addAdminRole(deployer, {'from': admin})

    # Setup MISOTokenFactory
    miso_token_factory = deploy_miso_token_factory(access_control)
    fixed_token_template = deploy_fixed_token_template()
    mintable_token_template = deploy_mintable_token_template()

    sushi_token_template = deploy_sushi_token_template()

    if miso_token_factory.tokenTemplateId() == 0:
        miso_token_factory.addTokenTemplate(
            mintable_token_template, {'from': deployer})
        miso_token_factory.addTokenTemplate(
            fixed_token_template, {'from': deployer})
        miso_token_factory.addTokenTemplate(
            sushi_token_template, {'from': deployer})

    # Setup MISO Market
    bento_box = deploy_bento_box()
    crowdsale_template = deploy_crowdsale_template()
    dutch_auction_template = deploy_dutch_auction_template()
    batch_auction_template = deploy_batch_auction_template()
    hyperbolic_auction_template = deploy_hyperbolic_auction_template()

    miso_market = deploy_miso_market(access_control, bento_box, [
                                     dutch_auction_template, crowdsale_template, batch_auction_template, hyperbolic_auction_template])

    # Setup PointList
    pointlist_template = deploy_pointlist_template()
    pointlist_factory = deploy_pointlist_factory(
        pointlist_template, access_control, 0)

    # MISOLauncher
    weth_token = deploy_weth_token()

    post_auction_template = deploy_post_auction_template(weth_token)    
    miso_launcher = deploy_miso_launcher(access_control, weth_token, bento_box)
    if miso_launcher.launcherTemplateId() == 0:
        miso_launcher.addLiquidityLauncherTemplate(post_auction_template, {"from": accounts[0]} )

    # MISOFarmFactory
    masterchef_template = deploy_masterchef_template()
    farm_factory = deploy_farm_factory(access_control)
    if farm_factory.farmTemplateId() == 0:
        farm_factory.addFarmTemplate(
            masterchef_template, {"from": accounts[0]})

    # Helper contract
    miso_helper = deploy_miso_helper(
        access_control, miso_token_factory, miso_market, miso_launcher, farm_factory)

    # Set Factory lock status
    if unlock and miso_market.locked() == True:
        miso_market.setLocked(False, {'from': accounts[0]} )
    if unlock and farm_factory.locked() == True:
        farm_factory.setLocked(False, {'from': accounts[0]} )
    if unlock and miso_launcher.locked() == True:
        miso_launcher.setLocked(False, {'from': accounts[0]} )
    if unlock and miso_token_factory.locked() == True:
        miso_token_factory.setLocked(False, {'from': accounts[0]} )

    # Revoke deployer admin rights
    access_control.removeOperatorRole(deployer, {'from': accounts[0]})
    access_control.removeAdminRole(deployer, {'from': accounts[0]})
