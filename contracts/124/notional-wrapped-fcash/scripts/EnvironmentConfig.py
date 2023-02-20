import json

from brownie import accounts
from brownie.network.contract import Contract

with open("abi/nComptroller.json", "r") as a:
    Comptroller = json.load(a)

with open("abi/nCErc20.json") as a:
    cToken = json.load(a)

with open("abi/nCEther.json") as a:
    cEther = json.load(a)

with open("abi/ERC20.json") as a:
    ERC20ABI = json.load(a)

with open("abi/Notional.json") as a:
    NotionalABI = json.load(a)

ETH_ADDRESS = "0x0000000000000000000000000000000000000000"

networks = {}

with open("v2.mainnet.json", "r") as f:
    networks["mainnet"] = json.load(f)

with open("v2.kovan.json", "r") as f:
    networks["kovan"] = json.load(f)

class Environment:
    def __init__(self, network) -> None:
        self.network = network
        addresses = networks[network]

        self.notional = Contract.from_abi(
            "Notional", addresses["notional"], NotionalABI
        )

        self.tokens = {}
        for (symbol, addr) in addresses["tokens"].items():
            if symbol.startswith("c"):
                self.tokens[symbol] = Contract.from_abi(symbol, addr, cToken["abi"])
            else:
                self.tokens[symbol] = Contract.from_abi(symbol, addr, ERC20ABI)

        self.whales = {}
        for (name, addr) in addresses["whales"].items():
            self.whales[name] = accounts.at(addr, force=True)

        self.deployer = accounts.at(addresses["deployer"], force=True)
        self.owner = accounts.at(self.notional.owner(), force=True)


def getEnvironment(network = "mainnet"):
    return Environment(network)
