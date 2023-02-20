import eth_abi
import time
import json
from brownie import ETH_ADDRESS, ZERO_ADDRESS, EIP1271Wallet
from brownie.network.state import Chain
from brownie import network, accounts, interface, web3, Contract

chain = Chain()

EnvironmentConfig = {
    "mainnet": {
        "0x": {
            "exchangeV2": "0x080bf510FCbF18b91105470639e9561022937712",
            "exchangeV3": "0x61935cbdd02287b511119ddb11aeb42f1593b7ef",
            "ERC20AssetProxy": "0x95E6F48254609A6ee006F7D493c8e5fB97094ceF"
        },
        "tokens": {
            "ETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "WBTC": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        }
    }
}

class Order:
    def __init__(self, assetProxy, makerAddr, makerToken, makerAmt, takerToken, takerAmt) -> None:
        self.packedEncoder = eth_abi.codec.ABIEncoder(eth_abi.registry.registry_packed)
        self.makerAddress = makerAddr
        self.takerAddress = ZERO_ADDRESS
        self.feeRecipientAddress = ZERO_ADDRESS
        self.senderAddress = ZERO_ADDRESS
        self.makerAssetAmount = makerAmt
        self.takerAssetAmount = takerAmt
        self.makerFee = 0
        self.takerFee = 0
        self.expirationTimeSeconds = time.time() + 30000
        self.salt = time.time()
        self.makerAssetData = self.encodeAssetData(assetProxy, makerToken)
        self.takerAssetData = self.encodeAssetData(assetProxy, takerToken)
        self.makerFeeAssetData = "0x"
        self.takerFeeAssetData = "0x"

    def encodeAssetData(self, assetProxy, token):
        return assetProxy.ERC20Token.encode_input(token)

    def hash(self, exchange):
        info = exchange.contract.getOrderInfo(self.getParams())
        return info[1]

    def sign(self, exchange, account):
        return self.rawSign(exchange, account) + "07" # 07 = EIP1271

    def rawSign(self, exchange, account):
        return account.sign_defunct_message_raw(self.hash(exchange)).signature.hex()

    def getParams(self):
        return [
            self.makerAddress,
            self.takerAddress,
            self.feeRecipientAddress,
            self.senderAddress,
            int(self.makerAssetAmount),
            int(self.takerAssetAmount),
            self.makerFee,
            self.takerFee,
            self.expirationTimeSeconds,
            self.salt,
            self.makerAssetData,
            self.takerAssetData,
            self.makerFeeAssetData,
            self.takerFeeAssetData
        ]

class ExchangeV3:
    def __init__(self, config):
        with open("./abi/0x/ExchangeV3.json", "r") as f:
            abi = json.load(f)
        self.contract = Contract.from_abi("ExchangeV3", config["0x"]["exchangeV3"], abi)

class Environment:
    def __init__(self, config):
        self.config = config
        self.tokens = {}
        self.tokens["ETH"] = self.loadTokenProxy(self.config, "ETH")
        self.tokens["DAI"] = self.loadTokenProxy(self.config, "DAI")
        self.deployer = accounts.at("0x2a956Fe94ff89D8992107c8eD4805c30ff1106ef", force=True)   
    def loadTokenProxy(self, config, token):
        with open("./abi/ERC20.json", "r") as f:
            abi = json.load(f)
        return Contract.from_abi(token, config["tokens"][token], abi)  

def create_environment():
    return Environment(EnvironmentConfig["mainnet"])

def main():
    networkName = network.show_active()
    if networkName == "hardhat-fork":
        networkName = "mainnet"
    config = EnvironmentConfig[networkName]
    env = Environment(config)
    exchange = ExchangeV3(config)
    deployer = accounts.load("KOVAN_DEPLOYER")
    wallet = EIP1271Wallet.deploy(deployer.address, config["0x"]["ERC20AssetProxy"], { "from": deployer })
    assetProxy = interface.ERC20Proxy(config["0x"]["exchangeV3"])
    
    DAIWhale = accounts.at("0x6dfaf865a93d3b0b5cfd1b4db192d1505676645b", force=True)
    WETHWhale = accounts.at("0x6555e1cc97d3cba6eaddebbcd7ca51d75771e0b8", force=True)

    wallet.approveToken(env.tokens["DAI"], 2 ** 255, { "from": deployer })
    env.tokens["DAI"].transfer(wallet.address, 10000e18, { "from": DAIWhale })
    env.tokens["ETH"].approve(exchange.contract.address, 2 ** 255, { "from": WETHWhale })

    order = Order(assetProxy, wallet.address, config["tokens"]["DAI"], 4000e18, config["tokens"]["ETH"], 1e18)
