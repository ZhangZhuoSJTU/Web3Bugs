import json
import os

from brownie import (
    accounts,
    nCErc20,
    nCEther,
    nComptroller,
    nJumpRateModel,
    nPriceOracle,
    nWhitePaperInterestRateModel,
)
from scripts.config import CompoundConfig


def deployCToken(symbol, underlyingTokenAddress, rate, comptroller, compPriceOracle, deployer):
    cToken = None
    config = CompoundConfig[symbol]
    # Deploy interest rate model
    interestRateModel = None
    if config["interestRateModel"]["name"] == "whitepaper":
        interestRateModel = nWhitePaperInterestRateModel.deploy(
            config["interestRateModel"]["baseRate"],
            config["interestRateModel"]["multiplier"],
            {"from": deployer},
        )
    elif config["interestRateModel"]["name"] == "jump":
        interestRateModel = nJumpRateModel.deploy(
            config["interestRateModel"]["baseRate"],
            config["interestRateModel"]["multiplier"],
            config["interestRateModel"]["jumpMultiplierPerYear"],
            config["interestRateModel"]["kink"],
            {"from": deployer},
        )

    if symbol == "ETH":
        cToken = nCEther.deploy(
            comptroller.address,
            interestRateModel.address,
            config["initialExchangeRate"],
            "Compound Ether",
            "cETH",
            8,
            deployer.address,
            {"from": deployer},
        )
    else:
        cToken = nCErc20.deploy(
            underlyingTokenAddress,
            comptroller.address,
            interestRateModel.address,
            config["initialExchangeRate"],
            "Compound " + symbol,  # This is not exactly correct but whatever
            "c" + symbol,
            8,
            deployer.address,
            {"from": deployer},
        )

    comptroller._supportMarket(cToken.address, {"from": deployer})
    comptroller._setCollateralFactor(cToken.address, 750000000000000000, {"from": deployer})
    if symbol != "ETH":
        compPriceOracle.setUnderlyingPrice(cToken.address, rate)

    return cToken


def main():
    with open("kovan.json", "r") as f:
        addresses = json.load(f)

    deployer = accounts.add(private_key=os.environ["TESTNET_PRIVATE_KEY"])
    compPriceOracle = nPriceOracle.deploy({"from": deployer})
    comptroller = nComptroller.deploy({"from": deployer})
    comptroller._setMaxAssets(20)
    comptroller._setPriceOracle(compPriceOracle.address)

    cETH = deployCToken("ETH", None, 2000000000, comptroller, compPriceOracle, deployer)
    cUSDC = deployCToken("USDC", addresses["USDC"], 1000000, comptroller, compPriceOracle, deployer)
    cDAI = deployCToken("DAI", addresses["DAI"], 1000000, comptroller, compPriceOracle, deployer)
    cWBTC = deployCToken(
        "WBTC", addresses["WBTC"], 35000000000, comptroller, compPriceOracle, deployer
    )

    addresses.update(
        {
            "compAdmin": deployer.address,
            "comptroller": comptroller.address,
            "compPriceOracle": compPriceOracle.address,
            "cETH": cETH.address,
            "cUSDC": cUSDC.address,
            "cDAI": cDAI.address,
            "cWBTC": cWBTC.address,
        }
    )

    with open("kovan.json", "w") as f:
        json.dump(addresses, f, sort_keys=True, indent=4)
