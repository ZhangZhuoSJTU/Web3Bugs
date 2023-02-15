import json
import eth_abi
import eth_keys
import time
from brownie import ZERO_ADDRESS, accounts, Contract, interface, sNOTE, nProxy, EmptyProxy, TreasuryManager
from brownie.network.state import Chain
from brownie.convert.datatypes import Wei
from eth_account._utils.signing import sign_message_hash
from eth_account.datastructures import SignedMessage
from eth_account.messages import defunct_hash_message
from hexbytes import HexBytes

ETH_ADDRESS = "0x0000000000000000000000000000000000000000"

chain = Chain()

EnvironmentConfig = {
    "BalancerVault": "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    "WeightedPool2TokensFactory": "0xA5bf2ddF098bb0Ef6d120C98217dD6B141c74EE0",
    "NOTE": "0xCFEAead4947f0705A14ec42aC3D44129E1Ef3eD5",
    "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    "Notional": "0x1344a36a1b56144c3bc62e7757377d288fde0369",
    "ERC20AssetProxy": "0x95E6F48254609A6ee006F7D493c8e5fB97094ceF",
    "ExchangeV3": "0x61935cbdd02287b511119ddb11aeb42f1593b7ef",
    "balancerPoolConfig": {
        "name": "Staked NOTE Weighted Pool",
        "symbol": "sNOTE-BPT",
        "tokens": [
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", # WETH
            "0xCFEAead4947f0705A14ec42aC3D44129E1Ef3eD5", # NOTE
        ],
        "weights": [ 0.2e18, 0.8e18 ],
        "swapFeePercentage": 0.005e18, # 0.5%
        "oracleEnable": True,
        "initBalances": [ Wei(20e18), Wei(100e8) ]
    },
    'sNOTEPoolAddress': None,
    'sNOTEPoolId': None,
    'sNOTEConfig': {
        'owner': '0x22341fB5D92D3d801144aA5A925F401A91418A05',
        'coolDownSeconds': 100
    }
}

def sign_defunct_message_raw(account, message: bytes) -> SignedMessage:
    """Signs an `EIP-191` using this account's private key.

    Args:
        message: An text

    Returns:
        An eth_account `SignedMessage` instance.
    """
    msg_hash_bytes = defunct_hash_message(message)
    eth_private_key = eth_keys.keys.PrivateKey(HexBytes(account.private_key))
    (v, r, s, eth_signature_bytes) = sign_message_hash(eth_private_key, msg_hash_bytes)
    return SignedMessage(
        messageHash=msg_hash_bytes,
        r=r,
        s=s,
        v=v,
        signature=HexBytes(eth_signature_bytes),
    )
    
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
        info = exchange.getOrderInfo(self.getParams())
        return info[1]

    def sign(self, exchange, account):
        return self.rawSign(exchange, account) + "07" # 07 = EIP1271

    def rawSign(self, exchange, account):
        return sign_defunct_message_raw(account, self.hash(exchange)).signature.hex()

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


class TestAccounts:
    def __init__(self) -> None:
        self.DAIWhale = accounts.at("0x6dfaf865a93d3b0b5cfd1b4db192d1505676645b", force=True) # A good source of DAI
        self.cDAIWhale = accounts.at("0x33b890d6574172e93e58528cd99123a88c0756e9", force=True) # A good source of cDAI
        self.ETHWhale = accounts.at("0x7D24796f7dDB17d73e8B1d0A3bbD103FBA2cb2FE", force=True) # A good source of ETH
        self.cETHWhale = accounts.at("0x1a1cd9c606727a7400bb2da6e4d5c70db5b4cade", force=True) # A good source of cETH
        self.NOTEWhale = accounts.at("0x22341fB5D92D3d801144aA5A925F401A91418A05", force=True)
        self.WETHWhale = accounts.at("0x6555e1cc97d3cba6eaddebbcd7ca51d75771e0b8", force=True)
        self.testManager = accounts.add('43a6634021d4b1ff7fd350843eebaa7cf547aefbf9503c33af0ec27c83f76827')

class Environment:
    def __init__(self, config, deployer) -> None:
        self.config = config
        self.deployer = deployer
        self.balancerVault = self.loadBalancerVault(self.config["BalancerVault"])
        self.pool2TokensFactory = self.loadPool2TokensFactory(self.config["WeightedPool2TokensFactory"])
        self.note = self.loadNOTE(self.config["NOTE"])
        self.dai = self.loadERC20Token("DAI")
        self.weth = self.load_WETH(self.config["WETH"])
        if self.config['sNOTEPoolAddress']:
            self.balancerPool = self.loadBalancerPool(self.config['sNOTEPoolAddress'])
            self.poolId = self.config['sNOTEPoolId']
            self.sNOTE = self.load_sNOTE(self.config['sNOTE'])
        else:
            self.sNOTEProxy = self.deployEmptyProxy()
            self.deployBalancerPool(self.config['balancerPoolConfig'], self.sNOTEProxy.address, self.deployer)
            self.sNOTE = self.upgrade_sNOTE()
            self.initBalancerPool(self.deployer)
        self.treasuryManager = self.deployTreasuryManager()
        self.DAIToken = self.loadERC20Token("DAI")
        self.exchangeV3 = self.loadExchangeV3(self.config['ExchangeV3'])
        self.assetProxy = interface.ERC20Proxy(self.config["ExchangeV3"])

    def loadExchangeV3(self, address):
        with open("./abi/0x/ExchangeV3.json", "r") as f:
            abi = json.load(f)
        return Contract.from_abi("ExchangeV3", address, abi)

    def loadNOTE(self, address):
        with open("./abi/notional/note.json", "r") as f:
            abi = json.load(f)
        return Contract.from_abi('NOTE', address, abi)

    def load_sNOTE(self, address):
        return Contract.from_abi('sNOTE', address, sNOTE.abi)

    def load_WETH(self, address):
        with open("./abi/ERC20.json", "r") as f:
            abi = json.load(f)
        return Contract.from_abi('WETH', address, abi)

    def loadBalancerPool(self, address):
        with open("./abi/balancer/pool.json", "r") as f:
            abi = json.load(f)
        return Contract.from_abi('BalancerPool', address, abi)

    def loadBalancerVault(self, address):
        with open("./abi/balancer/vault.json", "r") as f:
            abi = json.load(f)
        return Contract.from_abi('BalancerVault', address, abi)

    def loadPool2TokensFactory(self, address):
        with open("./abi/balancer/poolFactory.json", "r") as f:
            abi = json.load(f)
        return Contract.from_abi('Weighted Pool 2 Token Factory', address, abi)

    def loadERC20Token(self, token):
        with open("./abi/ERC20.json", "r") as f:
            abi = json.load(f)
        return Contract.from_abi(token, EnvironmentConfig[token], abi)

    def deployEmptyProxy(self):
        # Deploys an empty proxy to get the sNOTE address
        emptyProxyImpl = EmptyProxy.deploy({"from": self.deployer})
        proxy = nProxy.deploy(emptyProxyImpl.address, bytes(), {"from": self.deployer})
        return Contract.from_abi("Proxy", proxy.address, EmptyProxy.abi)

    def upgrade_sNOTE(self):
        sNOTEImpl = sNOTE.deploy(
            self.balancerVault.address,
            self.poolId,
            self.note.address,
            self.weth.address,
            {"from": self.deployer}
        )

        initializeCallData = sNOTEImpl.initialize.encode_input(
            self.config['sNOTEConfig']['owner'],
            self.config['sNOTEConfig']['coolDownSeconds']
        )

        self.sNOTEProxy.upgradeToAndCall(sNOTEImpl, initializeCallData, {'from': self.deployer})
        return self.load_sNOTE(self.sNOTEProxy.address)

    def deployBalancerPool(self, poolConfig, owner, deployer):
        # NOTE: owner is immutable, need to deploy the proxy first
        txn = self.pool2TokensFactory.create(
            poolConfig["name"],
            poolConfig["symbol"],
            poolConfig["tokens"],
            poolConfig["weights"],
            poolConfig["swapFeePercentage"],
            poolConfig["oracleEnable"],
            owner,
            {"from": deployer}
        )
        poolRegistered = txn.events["PoolRegistered"]
        self.balancerPool = self.loadBalancerPool(poolRegistered['poolAddress'])
        self.poolId = poolRegistered['poolId']

    def initBalancerPool(self, initializer):
        self.note.approve(self.balancerVault.address, 2**256 - 1, {"from": initializer})
        userData = eth_abi.encode_abi(
            ['uint256', 'uint256[]'],
            [0, self.config["balancerPoolConfig"]["initBalances"]]
        )

        self.balancerVault.joinPool(
            self.poolId,
            initializer.address,
            self.sNOTE,
            (
                [ETH_ADDRESS, self.note.address],
                self.config['balancerPoolConfig']["initBalances"],
                userData,
                False
            ),
            {
                "from": initializer,
                "value": self.config["balancerPoolConfig"]["initBalances"][0]
            }
        )
    
    def deployTreasuryManager(self):
        treasuryManager = TreasuryManager.deploy(
            EnvironmentConfig["Notional"],
            EnvironmentConfig["WETH"],
            self.balancerVault,
            self.poolId,
            EnvironmentConfig["NOTE"],
            self.sNOTEProxy.address,
            EnvironmentConfig["ERC20AssetProxy"],            
            { "from": self.deployer }
        )
        initData = treasuryManager.initialize.encode_input(self.deployer, self.deployer)
        proxy = nProxy.deploy(treasuryManager.address, initData, {"from": self.deployer})
        return Contract.from_abi("TreasuryManagerProxy", proxy.address, TreasuryManager.abi)

    def buyNOTE(self, amount, account):
        self.balancerVault.swap([
            self.poolId,
            1,
            EnvironmentConfig["WETH"],
            EnvironmentConfig["NOTE"],
            amount,
            0x0
        ], [
            account,
            False,
            account,
            False
        ], 2**255, chain.time() + 20000, { "from": account })

    def sellNOTE(self, amount, account):
        self.balancerVault.swap([
            self.poolId,
            0,
            EnvironmentConfig["NOTE"],
            EnvironmentConfig["WETH"],
            amount,
            0x0
        ], [
            account,
            False,
            account,
            False
        ], 0, chain.time() + 20000, { "from": account })
    
    def getBPTOraclePrice(self):
        return self.BPTPriceOracle.getLatest(1)

def create_environment():
    testAccounts = TestAccounts()
    return Environment(EnvironmentConfig, testAccounts.NOTEWhale)

def main():
    env = create_environment()
    testAccounts = TestAccounts()
