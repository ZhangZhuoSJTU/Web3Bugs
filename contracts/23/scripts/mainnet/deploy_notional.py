import json
import re
import subprocess

import scripts.mainnet.deploy_governance as deploy_governance
from brownie import (
    MockAggregator,
    MockCToken,
    MockERC20,
    NoteERC20,
    accounts,
    cTokenAggregator,
    network,
)
from brownie.network.contract import Contract
from scripts.config import CurrencyDefaults
from scripts.deployment import TokenType, deployNotional
from scripts.mainnet.deploy_governance import EnvironmentConfig

TokenConfig = {
    "kovan": {
        "cETH": "0x40575f9Eb401f63f66F4c434248ad83D3441bf61",
        "DAI": {
            "assetToken": (
                "0x4dC87A3D30C4A1B33E4349f02F4c5B1B1eF9A75D",
                False,
                TokenType["cToken"],
            ),
            "underlyingToken": (
                "0x181D62Ff8C0aEeD5Bc2Bf77A88C07235c4cc6905",
                False,
                TokenType["UnderlyingToken"],
            ),
            "ethOracle": "0x990DE64Bb3E1B6D99b1B50567fC9Ccc0b9891A4D",
            "ethOracleMustInvert": False,
        },
        "USDC": {
            "assetToken": (
                "0xf17C5c7240CBc83D3186A9d6935F003e451C5cDd",
                False,
                TokenType["cToken"],
            ),
            "underlyingToken": (
                "0xF503D5cd87d10Ce8172F9e77f76ADE8109037b4c",
                False,
                TokenType["UnderlyingToken"],
            ),
            "ethOracle": "0x0988059AF97c65D6a6EB8AcA422784728d907406",
            "ethOracleMustInvert": False,
        },
        "USDT": {
            "assetToken": (
                "0xBE2720C0064BF3A0E8F5f83f5B9FaC266c5Ce99E",
                False,
                TokenType["cToken"],
            ),
            # USDT potentially has a transfer fee
            "underlyingToken": (
                "0x52EDEb260f0cb805d9224d00741a576752F045b7",
                True,
                TokenType["UnderlyingToken"],
            ),
            "ethOracle": "0x799e64CfAC5Feb421CBf76FA759B0672a03bcf71",
            "ethOracleMustInvert": False,
        },
        "WBTC": {
            "assetToken": (
                "0xA8E51e20985E926dE882EE700eC7F7d51D89D130",
                False,
                TokenType["cToken"],
            ),
            "underlyingToken": (
                "0x45a8451ceaae5976b4ae5f14a7ad789fae8e9971",
                False,
                TokenType["UnderlyingToken"],
            ),
            "ethOracle": "0x0CB9a95789929dC75D1B77A916762Bc719305543",
            "ethOracleMustInvert": False,
        },
    },
    "mainnet": {
        "cETH": "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
        "DAI": {
            "assetToken": (
                "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",
                False,
                TokenType["cToken"],
            ),
            "underlyingToken": (
                "0x6B175474E89094C44Da98b954EedeAC495271d0F",
                False,
                TokenType["UnderlyingToken"],
            ),
            "ethOracle": "0x773616E4d11A78F511299002da57A0a94577F1f4",
            "ethOracleMustInvert": False,
        },
        "USDC": {
            "assetToken": (
                "0x39aa39c021dfbae8fac545936693ac917d5e7563",
                False,
                TokenType["cToken"],
            ),
            "underlyingToken": (
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                False,
                TokenType["UnderlyingToken"],
            ),
            "ethOracle": "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4",
            "ethOracleMustInvert": False,
        },
        "USDT": {
            "assetToken": (
                "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
                False,
                TokenType["cToken"],
            ),
            # USDT potentially has a transfer fee
            "underlyingToken": (
                "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                True,
                TokenType["UnderlyingToken"],
            ),
            "ethOracle": "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46",
            "ethOracleMustInvert": False,
        },
        "WBTC": {
            "assetToken": (
                "0xC11b1268C1A384e55C48c2391d8d480264A3A7F4",
                False,
                TokenType["cToken"],
            ),
            "underlyingToken": (
                "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
                False,
                TokenType["UnderlyingToken"],
            ),
            "ethOracle": "0xdeb288F737066589598e9214E782fa5A8eD689e8",
            "ethOracleMustInvert": False,
        },
    },
}

# Currency Config will inherit CurrencyDefaults except where otherwise specified
CurrencyConfig = {
    "ETH": {
        **CurrencyDefaults,
        **{
            "name": "Ether",
            "buffer": 130,
            "haircut": 70,
            "liquidationDiscount": 108,
            "tokenHaircut": (95, 90),
            "rateScalar": (21, 21),
        },
    },
    "DAI": {
        **CurrencyDefaults,
        **{
            "name": "Dai Stablecoin",
            "maxMarketIndex": 3,
            "buffer": 105,
            "haircut": 95,
            "liquidationDiscount": 104,
            "tokenHaircut": (95, 90, 87),
            "rateScalar": (21, 21, 21),
        },
    },
    "USDC": {
        **CurrencyDefaults,
        **{
            "name": "USD Coin",
            "maxMarketIndex": 3,
            "buffer": 105,
            "haircut": 95,
            "liquidationDiscount": 104,
            "tokenHaircut": (95, 90, 87),
            "rateScalar": (21, 21, 21),
        },
    },
    "WBTC": {
        **CurrencyDefaults,
        **{
            "name": "Wrapped BTC",
            "buffer": 130,
            "haircut": 70,
            "liquidationDiscount": 110,
            "tokenHaircut": (95, 90),
            "rateScalar": (21, 21),
        },
    },
    "USDT": {
        **CurrencyDefaults,
        **{
            "name": "Tether USD",
            "maxMarketIndex": 3,
            "buffer": 105,
            "haircut": 0,
            "liquidationDiscount": 104,
            "tokenHaircut": (95, 90, 87),
            "rateScalar": (21, 21, 21),
        },
    },
}

nTokenCryptoAssetConfig = {
    "Deposit": [
        # Deposit shares
        [int(0.5e8), int(0.5e8)],
        # Leverage thresholds
        [int(0.75e9), int(0.75e9)],
    ],
    "Initialization": [
        # Rate anchors
        [int(1.01e9), int(1.01e9)],
        # Target proportion
        [int(0.5e9), int(0.5e9)],
    ],
    "Collateral": [
        20,  # residual purchase incentive bps
        85,  # pv haircut
        24,  # time buffer hours
        60,  # cash withholding
        92,  # liquidation haircut percentage
    ],
}

nTokenStablecoinConfig = {
    "Deposit": [
        # Deposit shares
        [int(0.25e8), int(0.25e8), int(0.5e8)],
        # Leverage thresholds
        [int(0.78e9), int(0.79e9), int(0.79e9)],
    ],
    "Initialization": [
        # Rate anchors
        [int(1.02e9), int(1.02e9), int(1.02e9)],
        # Target proportion
        [int(0.5e9), int(0.5e9), int(0.5e9)],
    ],
    "Collateral": [
        20,  # residual purchase incentive bps
        85,  # pv haircut
        24,  # time buffer hours
        80,  # cash withholding
        92,  # liquidation haircut percentage
    ],
}

nTokenConfig = {
    "ETH": nTokenCryptoAssetConfig,
    "DAI": nTokenStablecoinConfig,
    "USDC": nTokenStablecoinConfig,
    "WBTC": nTokenCryptoAssetConfig,
    "USDT": nTokenStablecoinConfig,
}


def listCurrency(notional, deployer, symbol):
    networkName = network.show_active()
    if symbol == "ETH":
        currencyId = 1
        assetRateAggregator = cTokenAggregator.deploy(
            TokenConfig[networkName]["cETH"], {"from": deployer}
        )
    else:
        print("Listing currency {}".format(symbol))
        txn = notional.listCurrency(
            TokenConfig[networkName][symbol]["assetToken"],
            TokenConfig[networkName][symbol]["underlyingToken"],
            TokenConfig[networkName][symbol]["ethOracle"],
            TokenConfig[networkName][symbol]["ethOracleMustInvert"],
            CurrencyConfig[symbol]["buffer"],
            CurrencyConfig[symbol]["haircut"],
            CurrencyConfig[symbol]["liquidationDiscount"],
            {"from": deployer},
        )
        currencyId = txn.events["ListCurrency"]["newCurrencyId"]
        print("Listed currency {} with id {}".format(symbol, currencyId))

        assetRateAggregator = cTokenAggregator.deploy(
            TokenConfig[networkName][symbol]["assetToken"][0], {"from": deployer}
        )
        print("Deployed cToken aggregator at {}".format(assetRateAggregator.address))

    txn = notional.enableCashGroup(
        currencyId,
        assetRateAggregator.address,
        (
            CurrencyConfig[symbol]["maxMarketIndex"],
            CurrencyConfig[symbol]["rateOracleTimeWindow"],
            CurrencyConfig[symbol]["totalFee"],
            CurrencyConfig[symbol]["reserveFeeShare"],
            CurrencyConfig[symbol]["debtBuffer"],
            CurrencyConfig[symbol]["fCashHaircut"],
            CurrencyConfig[symbol]["settlementPenalty"],
            CurrencyConfig[symbol]["liquidationfCashDiscount"],
            CurrencyConfig[symbol]["liquidationDebtBuffer"],
            CurrencyConfig[symbol]["tokenHaircut"],
            CurrencyConfig[symbol]["rateScalar"],
        ),
        CurrencyConfig[symbol]["name"],
        symbol,
        {"from": deployer},
    )

    notional.updateDepositParameters(
        currencyId, *(nTokenConfig[symbol]["Deposit"]), {"from": deployer}
    )

    notional.updateInitializationParameters(
        currencyId, *(nTokenConfig[symbol]["Initialization"]), {"from": deployer}
    )

    notional.updateTokenCollateralParameters(
        currencyId, *(nTokenConfig[symbol]["Collateral"]), {"from": deployer}
    )

    notional.updateIncentiveEmissionRate(
        currencyId, CurrencyConfig[symbol]["incentiveEmissionRate"], {"from": deployer}
    )


def main():
    deployer = accounts.load(network.show_active().upper() + "_DEPLOYER")
    output_file = "v2.{}.json".format(network.show_active())
    output = None
    with open(output_file, "r") as f:
        output = json.load(f)

    if network.show_active() == "development":
        deploy_governance.main()

        accounts[0].transfer(deployer, 100e18)
        cETH = MockERC20.deploy("Compound Ether", "cETH", 8, 0, {"from": accounts[0]})
        DAI = MockERC20.deploy("Dai Stablecoin", "DAI", 18, 0, {"from": accounts[0]})
        cDAI = MockCToken.deploy(8, {"from": accounts[0]})
        cDAI.setUnderlying(DAI.address)
        ethDaiOracle = MockAggregator.deploy(18, {"from": accounts[0]})
        ethDaiOracle.setAnswer(0.01e18)
        TokenConfig["development"] = {
            "cETH": cETH.address,
            "DAI": {
                "assetToken": (cDAI.address, False, TokenType["cToken"]),
                "underlyingToken": (DAI.address, False, TokenType["UnderlyingToken"]),
                "ethOracle": ethDaiOracle.address,
                "ethOracleMustInvert": False,
            },
        }

    print("Confirming that NOTE token is hardcoded properly in Constants.sol")
    with open("contracts/global/Constants.sol") as f:
        constants = f.read()
        m = re.search("address constant NOTE_TOKEN_ADDRESS = (.*);", constants)
        assert m.group(1) == output["note"]

    (pauseRouter, router, proxy, notional, contracts) = deployNotional(
        deployer,
        TokenConfig[network.show_active()]["cETH"],
        EnvironmentConfig[network.show_active()]["GuardianMultisig"],
    )

    # At this point Notional is owned by the deployer. Now will go ahead
    # and set the initial configuration
    listCurrency(notional, deployer, "ETH")
    listCurrency(notional, deployer, "DAI")

    if network.show_active() != "development":
        listCurrency(notional, deployer, "USDC")
        listCurrency(notional, deployer, "WBTC")

    if network.show_active() == "development":
        # NOTE: Activate notional needs to be called via the guardian
        noteERC20 = Contract.from_abi("NOTE", output["note"], abi=NoteERC20.abi)
        noteERC20.activateNotional(notional.address, {"from": accounts[0]})

        # Test to see if this method reverts or not
        noteERC20.getCurrentVotes(deployer)

    with open(output_file, "w") as f:
        output["notional"] = notional.address
        json.dump(output, f, sort_keys=True, indent=4)

    if network.show_active() != "development":
        etherscan_verify(contracts, router, pauseRouter)


def etherscan_verify(contracts, router, pauseRouter):
    for (name, contract) in contracts.items():
        print("Verifying {} at {}".format(name, contract.address))
        verify(contract.address, [])

    print("Verifying Pause Router at {}".format(pauseRouter.address))
    verify(pauseRouter.address, [contracts["Views"].address])
    print("Verifying Router at {}".format(router.address))
    routerArgs = [
        contracts["Governance"].address,
        contracts["Views"].address,
        contracts["InitializeMarketsAction"].address,
        contracts["nTokenAction"].address,
        contracts["nTokenRedeemAction"].address,
        contracts["BatchAction"].address,
        contracts["AccountAction"].address,
        contracts["ERC1155Action"].address,
        contracts["LiquidateCurrencyAction"].address,
        contracts["LiquidatefCashAction"].address,
        TokenConfig[network.show_active()]["cETH"],
    ]
    print("Using router args: ", routerArgs)
    verify(router.address, routerArgs)


def verify(address, args):
    proc = subprocess.run(
        ["npx", "hardhat", "verify", "--network", network.show_active(), address] + args,
        capture_output=True,
        encoding="utf8",
    )

    print(proc.stdout)
    print(proc.stderr)
