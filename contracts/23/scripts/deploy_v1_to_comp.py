import json
import os

from brownie import NotionalV1ToCompound, accounts, nTransparentUpgradeableProxy
from brownie.network import web3
from brownie.network.contract import Contract


def main():
    deployer = accounts.add(private_key=os.environ["TESTNET_PRIVATE_KEY"])
    with open("kovan.json", "r") as f:
        addresses = json.load(f)
    with open("./ERC1155Trade.json", "r") as f:
        ERC1155Artifact = json.load(f)
    with open("./ERC20.json", "r") as f:
        ERC20 = json.load(f)

    v1ToComp = NotionalV1ToCompound.deploy(
        addresses["escrow"],
        addresses["erc1155trade"],
        addresses["wETHwBTCUniswapV2"],
        addresses["WETH"],
        addresses["WBTC"],
        addresses["comptroller"],
        addresses["cETH"],
        addresses["cDAI"],
        addresses["cUSDC"],
        addresses["cWBTC"],
        {"from": deployer},
    )

    initializeData = web3.eth.contract(abi=NotionalV1ToCompound.abi).encodeABI(
        fn_name="initialize", args=[]
    )

    proxy = nTransparentUpgradeableProxy.deploy(
        v1ToComp.address,
        addresses["proxyAdmin"],  # Set your own proxy admin here...
        initializeData,  # Deployer is set to owner
        {"from": deployer},
    )

    migrator = Contract.from_abi(
        "Notional", proxy.address, abi=NotionalV1ToCompound.abi, owner=deployer
    )
    erc1155 = Contract.from_abi(
        "ERC1155Trade", address=addresses["erc1155trade"], abi=ERC1155Artifact["abi"]
    )
    usdc = Contract.from_abi("USDC", address=addresses["USDC"], abi=ERC20)
    erc1155.setApprovalForAll(migrator.address, True, {"from": deployer})
    usdc.approve(addresses["escrow"], 2 ** 255, {"from": deployer})
    # Get this value from etherscan
    v1RepayAmount = 1023298128
    migrator.migrateUSDCEther(v1RepayAmount, {"from": deployer})
