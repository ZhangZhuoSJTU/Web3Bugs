from brownie import *
from .settings import *
from .contracts import *
from .contract_addresses import *
import time


def main():

    miso_token_factory = deploy_miso_token_factory()
    mintable_token_template = deploy_mintable_token_template()
    mintable_token = deploy_mintable_token(
        miso_token_factory, mintable_token_template)

    token_factory = deploy_token_factory()
    fixed_token = deploy_fixed_token(token_factory)

    dutch_auction_template = deploy_dutch_auction_template()
    auction_house = deploy_auction_house(dutch_auction_template)
    fixed_token.approve(auction_house, AUCTION_TOKENS, {"from": accounts[0]})

    wallet = accounts[1]
    dutch_auction = deploy_dutch_auction(
        auction_house,
        dutch_auction_template,
        fixed_token,
        AUCTION_TOKENS,
        AUCTION_START,
        AUCTION_END,
        ETH_ADDRESS,
        AUCTION_START_PRICE,
        AUCTION_RESERVE,
        wallet
    )
