import json

from brownie import NotionalV1ToNotionalV2, accounts, nTransparentUpgradeableProxy
from brownie.network import web3
from brownie.network.contract import Contract
from brownie.network.state import Chain

ARTIFACTS = [
    "CashMarket",
    "Directory",
    "ERC1155Token",
    "ERC1155Trade",
    "Escrow",
    "Liquidation",
    "Portfolios",
    "RiskFramework",
    "WETH",
    "ERC1820Registry",
    "UniswapV2Factory",
    "UniswapV2Router02",
]

chain = Chain()


def load_artifacts():
    artifacts = {}
    for name in ARTIFACTS:
        with open("./scripts/v1artifacts/" + name + ".json", "r") as f:
            data = json.load(f)
            artifacts[name] = data

    return artifacts


def deploy_uniswap(tokens, artifacts, deployer, contracts):
    factory = web3.eth.contract(
        abi=artifacts["UniswapV2Factory"]["abi"], bytecode=artifacts["UniswapV2Factory"]["bytecode"]
    )
    tx_hash = factory.constructor(deployer.address).transact({"from": deployer.address})
    tx_receipt = web3.eth.waitForTransactionReceipt(tx_hash)

    contracts["uniswapFactory"] = Contract.from_abi(
        "UniswapFactory", tx_receipt.contractAddress, abi=factory.abi, owner=deployer.address
    )

    router = web3.eth.contract(
        abi=artifacts["UniswapV2Router02"]["abi"],
        bytecode=artifacts["UniswapV2Router02"]["bytecode"],
    )
    tx_hash = router.constructor(
        contracts["uniswapFactory"].address, contracts["WETH"].address
    ).transact({"from": deployer.address})
    tx_receipt = web3.eth.waitForTransactionReceipt(tx_hash)
    contracts["uniswapRouter"] = Contract.from_abi(
        "UniswapRouter", tx_receipt.contractAddress, abi=router.abi, owner=deployer.address
    )

    contracts["uniswapFactory"].createPair(tokens["WBTC"].address, contracts["WETH"].address)
    tokens["WBTC"].approve(contracts["uniswapRouter"].address, 2 ** 255, {"from": accounts[0]})
    contracts["uniswapRouter"].addLiquidityETH(
        tokens["WBTC"].address,
        1000e8,
        1000e8,
        1000e18,
        deployer.address,
        chain.time() + 864000000,
        {"from": accounts[0], "value": 1000e18},
    )


def deploy_proxied_contract(name, artifacts, deployer, proxyAdmin, contracts, constructor_args=[]):
    impl = deploy_contract(name, artifacts, deployer, contracts)

    initializeData = impl.encodeABI(fn_name="initialize", args=constructor_args)
    proxy = nTransparentUpgradeableProxy.deploy(
        impl.address, proxyAdmin.address, initializeData, {"from": deployer}
    )

    print("Deployed proxy for %s to %s" % (name, str(proxy.address)))

    return web3.eth.contract(abi=impl.abi, address=proxy.address)


def deploy_contract(name, artifacts, deployer, contracts=None):
    bytecode = artifacts[name]["bytecode"]
    if len(artifacts[name]["linkReferences"]) > 0:
        for (k, lib) in artifacts[name]["linkReferences"].items():
            address = None
            key = list(lib.keys())[0]
            if key == "Liquidation":
                address = contracts["Liquidation"].address
            else:
                address = contracts["RiskFramework"].address

            for offset in lib[key]:
                byteOffsetStart = offset["start"] * 2 + 2
                byteOffsetEnd = byteOffsetStart + offset["length"] * 2
                bytecode = bytecode[0:byteOffsetStart] + address[2:] + bytecode[byteOffsetEnd:]
    contract = web3.eth.contract(abi=artifacts[name]["abi"], bytecode=bytecode)

    tx_hash = contract.constructor().transact({"from": deployer.address})
    tx_receipt = web3.eth.waitForTransactionReceipt(tx_hash)

    print("%s deployed to %s" % (name, str(tx_receipt.contractAddress)))

    return web3.eth.contract(abi=contract.abi, address=tx_receipt.contractAddress)


def deploy_v1(v2env):
    artifacts = load_artifacts()
    contracts = {}
    deployer = accounts[9]
    proxyAdmin = v2env.proxyAdmin

    contracts["ERC1820Registry"] = deploy_contract("ERC1820Registry", artifacts, deployer)
    contracts["WETH"] = deploy_contract("WETH", artifacts, deployer)
    contracts["Liquidation"] = deploy_contract("Liquidation", artifacts, deployer)
    contracts["RiskFramework"] = deploy_contract("RiskFramework", artifacts, deployer)
    contracts["CashMarket"] = deploy_contract("CashMarket", artifacts, deployer)

    contracts["Directory"] = deploy_proxied_contract(
        "Directory", artifacts, deployer, proxyAdmin, contracts, [deployer.address]
    )

    contracts["Escrow"] = deploy_proxied_contract(
        "Escrow",
        artifacts,
        deployer,
        proxyAdmin,
        contracts,
        [
            contracts["Directory"].address,
            deployer.address,
            contracts["ERC1820Registry"].address,
            contracts["WETH"].address,
        ],
    )
    contracts["Portfolios"] = deploy_proxied_contract(
        "Portfolios",
        artifacts,
        deployer,
        proxyAdmin,
        contracts,
        [contracts["Directory"].address, deployer.address, 1, 8],
    )
    contracts["ERC1155Token"] = deploy_proxied_contract(
        "ERC1155Token",
        artifacts,
        deployer,
        proxyAdmin,
        contracts,
        [contracts["Directory"].address, deployer.address],
    )
    contracts["ERC1155Trade"] = deploy_proxied_contract(
        "ERC1155Trade",
        artifacts,
        deployer,
        proxyAdmin,
        contracts,
        [contracts["Directory"].address, deployer.address],
    )

    contracts["Directory"].functions.setContract(0, contracts["Escrow"].address).transact(
        {"from": deployer.address}
    )
    contracts["Directory"].functions.setContract(1, contracts["Portfolios"].address).transact(
        {"from": deployer.address}
    )
    contracts["Directory"].functions.setContract(2, contracts["ERC1155Token"].address).transact(
        {"from": deployer.address}
    )
    contracts["Directory"].functions.setContract(3, contracts["ERC1155Trade"].address).transact(
        {"from": deployer.address}
    )

    contracts["Directory"].functions.setDependencies(0, [1, 3]).transact({"from": deployer.address})
    contracts["Directory"].functions.setDependencies(1, [0, 2, 3]).transact(
        {"from": deployer.address}
    )
    contracts["Directory"].functions.setDependencies(2, [1]).transact({"from": deployer.address})
    contracts["Directory"].functions.setDependencies(3, [0, 1]).transact({"from": deployer.address})

    contracts["Escrow"].functions.setDiscounts(int(1.06e18), int(1.02e18), int(0.80e18)).transact(
        {"from": deployer.address}
    )
    contracts["Portfolios"].functions.setHaircuts(
        int(1.01e18), int(0.50e18), int(0.95e18)
    ).transact({"from": deployer.address})

    # list currencies
    contracts["Escrow"].functions.listCurrency(v2env.token["DAI"].address, [False, False]).transact(
        {"from": deployer.address}
    )
    contracts["Escrow"].functions.addExchangeRate(
        1, 0, v2env.ethOracle["DAI"].address, int(1.4e18), int(1e18), False
    ).transact({"from": deployer.address})

    contracts["Escrow"].functions.listCurrency(
        v2env.token["USDC"].address, [False, False]
    ).transact({"from": deployer.address})
    contracts["Escrow"].functions.addExchangeRate(
        2, 0, v2env.ethOracle["USDC"].address, int(1.4e18), int(1e18), False
    ).transact({"from": deployer.address})

    contracts["Escrow"].functions.listCurrency(
        v2env.token["WBTC"].address, [False, False]
    ).transact({"from": deployer.address})
    contracts["Escrow"].functions.addExchangeRate(
        3, 0, v2env.ethOracle["WBTC"].address, int(1.4e18), int(1e18), False
    ).transact({"from": deployer.address})

    contracts["DaiCashMarket"] = deploy_proxied_contract(
        "CashMarket",
        artifacts,
        deployer,
        proxyAdmin,
        contracts,
        [contracts["Directory"].address, deployer.address],
    )
    contracts["DaiCashMarket"].functions.initializeDependencies().transact(
        {"from": deployer.address}
    )
    contracts["Portfolios"].functions.createCashGroup(
        2, 2592000 * 3, int(1e9), 1, contracts["DaiCashMarket"].address
    ).transact({"from": deployer.address})

    contracts["DaiCashMarket"].functions.setMaxTradeSize(int(2 ** 127)).transact(
        {"from": deployer.address}
    )
    contracts["DaiCashMarket"].functions.setFee(int(7.5e5), 0).transact({"from": deployer.address})
    contracts["DaiCashMarket"].functions.setRateFactors(int(1.1e9), 85).transact(
        {"from": deployer.address}
    )

    contracts["USDCCashMarket"] = deploy_proxied_contract(
        "CashMarket",
        artifacts,
        deployer,
        proxyAdmin,
        contracts,
        [contracts["Directory"].address, deployer.address],
    )
    contracts["USDCCashMarket"].functions.initializeDependencies().transact(
        {"from": deployer.address}
    )
    contracts["Portfolios"].functions.createCashGroup(
        2, 2592000 * 3, int(1e9), 2, contracts["USDCCashMarket"].address
    ).transact({"from": deployer.address})

    contracts["USDCCashMarket"].functions.setMaxTradeSize(int(2 ** 127)).transact(
        {"from": deployer.address}
    )
    contracts["USDCCashMarket"].functions.setFee(int(7.5e5), 0).transact({"from": deployer.address})
    contracts["USDCCashMarket"].functions.setRateFactors(int(1.1e9), 85).transact(
        {"from": deployer.address}
    )

    # add liquidity
    lp = v2env.deployer
    v2env.token["DAI"].approve(contracts["Escrow"].address, 2 ** 255)
    contracts["Escrow"].functions.deposit(v2env.token["DAI"].address, int(6100000e18)).transact(
        {"from": lp.address}
    )
    maturities = contracts["DaiCashMarket"].functions.getActiveMaturities().call()
    for m in maturities:
        contracts["DaiCashMarket"].functions.addLiquidity(
            m, int(3000000e18), int(3000000e18), 0, int(1e9), 2 ** 31
        ).transact({"from": lp.address})

    v2env.token["USDC"].approve(contracts["Escrow"].address, 2 ** 255)
    contracts["Escrow"].functions.deposit(v2env.token["USDC"].address, int(6100000e6)).transact(
        {"from": lp.address}
    )
    maturities = contracts["USDCCashMarket"].functions.getActiveMaturities().call()
    for m in maturities:
        contracts["USDCCashMarket"].functions.addLiquidity(
            m, int(3000000e6), int(3000000e6), 0, int(1e9), 2 ** 31
        ).transact({"from": lp.address})

    deploy_uniswap(v2env.token, artifacts, deployer, contracts)

    contracts["Migrator"] = NotionalV1ToNotionalV2.deploy(
        contracts["Escrow"].address,
        v2env.notional.address,
        contracts["ERC1155Trade"].address,
        contracts["WETH"].address,
        v2env.token["WBTC"],
        2,
        3,
        4,
        {"from": deployer},
    )
    contracts["Migrator"].enableWBTC()

    return contracts
