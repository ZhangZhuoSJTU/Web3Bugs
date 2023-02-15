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

    # Setup MISOTokenFactory
    miso_token_factory = deploy_miso_token_factory(access_control)
    mintable_token_template = deploy_mintable_token_template()
    fixed_token_template = deploy_fixed_token_template()
    sushi_token_template = deploy_sushi_token_template()

    # miso_token_factory.addTokenTemplate(mintable_token_template, {'from': operator} )
    miso_token_factory.addTokenTemplate(
        fixed_token_template, {'from': operator})
    miso_token_factory.addTokenTemplate(
        sushi_token_template, {'from': operator})
