from brownie import *
from .settings import *
from .contracts import *
from .contract_addresses import *
import time


def main():
    load_accounts()
    gnosis_vault = GnosisVault.at(
        CONTRACTS[network.show_active()]["gnosis_vault"])
    print(gnosis_vault.proxy())
