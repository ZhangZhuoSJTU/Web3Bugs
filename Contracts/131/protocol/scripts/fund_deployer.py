from brownie import accounts
from support.utils import get_deployer, make_tx_params


def main():
    deployer = get_deployer()
    accounts[0].transfer(
        deployer.address, accounts[0].balance() - 1e18, **make_tx_params()
    )
