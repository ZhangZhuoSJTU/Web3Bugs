GovernanceConfig = {
    "initialBalances": {"DAO": 55_000_000e8, "MULTISIG": 44_000_000e8, "NOTIONAL": 1_000_000e8},
    "governorConfig": {
        "quorumVotes": 4_000_000e8,
        "proposalThreshold": 1_000_000e8,
        "votingDelayBlocks": 1,
        "votingPeriodBlocks": 10,
        "minDelay": 86400,
    },
}

TokenConfig = {
    "DAI": {"name": "Dai Stablecoin", "decimals": 18, "fee": 0, "rate": 0.01e18},
    "USDC": {"name": "USD Coin", "decimals": 6, "fee": 0, "rate": 0.01e18},
    "USDT": {"name": "Tether USD", "decimals": 6, "fee": 0.001e18, "rate": 0.01e18},
    "WBTC": {"name": "Wrapped Bitcoin", "decimals": 8, "fee": 0, "rate": 100e18},
    "NOMINT": {"name": "nonMintable", "decimals": 18, "fee": 0, "rate": 1e18},
}

CurrencyDefaults = {
    "buffer": 130,  # Stablecoins will be 105
    "haircut": 70,  # Stablecoins will be 95
    "liquidationDiscount": 105,
    # Cash group settings
    "maxMarketIndex": 2,
    "rateOracleTimeWindow": 20,
    "totalFee": 30,
    "reserveFeeShare": 50,
    "debtBuffer": 150,
    "fCashHaircut": 150,
    "settlementPenalty": 40,
    "liquidationfCashDiscount": 50,
    "liquidationDebtBuffer": 50,
    "tokenHaircut": (95, 90, 87, 80, 75, 70, 65),
    "rateScalar": (21, 21, 21, 21, 21, 21, 21),
    "incentiveEmissionRate": 100_000,
}

nTokenDefaults = {
    "Deposit": [
        # Deposit shares
        [int(0.5e8), int(0.5e8)],
        # Leverage thresholds
        [int(0.8e9), int(0.8e9)],
    ],
    "Initialization": [
        # Annualized Anchor Rates
        [int(0.02e9), int(0.02e9)],
        # Target proportion
        [int(0.5e9), int(0.5e9)],
    ],
    "Collateral": [
        20,  # residual purchase incentive bps
        85,  # pv haircut
        24,  # time buffer hours
        80,  # cash withholding
        92,  # liquidation haircut percentage
    ],
}

CompoundConfig = {
    # cETH uses whitepaper interest rate model
    # cETH: https://etherscan.io/address/0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5
    # Interest Rate Model:
    # https://etherscan.io/address/0x0c3f8df27e1a00b47653fde878d68d35f00714c0
    "ETH": {
        "initialExchangeRate": 200000000000000000000000000,
        "interestRateModel": {
            "name": "whitepaper",
            "baseRate": 20000000000000000,
            "multiplier": 100000000000000000,
        },
    },
    # cWBTC uses whitepaper interest rate model
    # cWBTC https://etherscan.io/address/0xc11b1268c1a384e55c48c2391d8d480264a3a7f4
    # Interest Rate Model:
    # https://etherscan.io/address/0xbae04cbf96391086dc643e842b517734e214d698#code
    "WBTC": {
        "initialExchangeRate": 20000000000000000,
        "interestRateModel": {
            "name": "whitepaper",
            "baseRate": 20000000000000000,
            "multiplier": 300000000000000000,
        },
    },
    # cDai: https://etherscan.io/address/0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643
    # Jump interest rate model:
    # https://etherscan.io/address/0xfb564da37b41b2f6b6edcc3e56fbf523bd9f2012
    "DAI": {
        "initialExchangeRate": 200000000000000000000000000,
        "interestRateModel": {
            "name": "jump",
            "baseRate": 0,
            "multiplier": 40000000000000000,
            "jumpMultiplierPerYear": 1090000000000000000,
            "kink": 800000000000000000,
        },
    },
    # cUSDC: https://etherscan.io/address/0x39aa39c021dfbae8fac545936693ac917d5e7563
    # Jump interest rate model:
    # https://etherscan.io/address/0xd8ec56013ea119e7181d231e5048f90fbbe753c0
    "USDC": {
        "initialExchangeRate": 200000000000000,
        "interestRateModel": {
            "name": "jump",
            "baseRate": 0,
            "multiplier": 40000000000000000,
            "jumpMultiplierPerYear": 1090000000000000000,
            "kink": 800000000000000000,
        },
    },
    # cTether: https://etherscan.io/address/0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9
    # Jump Rate mode: https://etherscan.io/address/0xfb564da37b41b2f6b6edcc3e56fbf523bd9f2012
    "USDT": {
        "initialExchangeRate": 200000000000000,
        "interestRateModel": {
            "name": "jump",
            "baseRate": 0,
            "multiplier": 40000000000000000,
            "jumpMultiplierPerYear": 1090000000000000000,
            "kink": 800000000000000000,
        },
    },
}
