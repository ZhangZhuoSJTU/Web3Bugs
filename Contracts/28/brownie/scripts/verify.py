from brownie import *
from .settings import *
from .contracts import *
from .contract_addresses import *
import time


def verify(contract_id, container):
    contract_address = CONTRACTS[network.show_active()][contract_id]
    contract = container.at(contract_address)
    print(contract_id, ": Verification initiated..")
    try:
        container.publish_source(contract)
        # print(container.get_verification_info())
    except:
        print(contract_id, ": Already verified")


def main():

    # verify("miso_token_factory", MISOTokenFactory)
    # verify("miso_launcher", MISOLauncher)
    # verify("mintable_token_template", MintableToken)
    # verify("fixed_token_template", FixedToken)
    # verify("sushi_token_template", SushiToken)
    # verify("dutch_auction_template", DutchAuction)
    verify("crowdsale_template", Crowdsale)
    # verify("pool_liquidity_template", PoolLiquidity)
    # verify("post_auction_launcher_template", PoolLiquidity)

    # verify("miso_market", MISOMarket)
    # verify("weth_token", WETH9)
    # verify("access_control", MISOAccessControls)
    # verify("masterchef_template", MISOMasterChef)
    # verify("farm_factory", MISOFarmFactory)
    # verify("miso_helper", MISOHelper)
