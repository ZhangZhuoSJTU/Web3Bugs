#!/usr/bin/python3

from brownie import Token, \
                    BTCPoolDelegator, \
                    USDPoolDelegator, \
                    ETHPoolDelegator, \
                    GaugeController, \
                    MainToken, \
                    VotingEscrow, \
                    Minter, \
                    LPToken, \
                    PoolGauge, \
                    accounts

# wBTC = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"
# sBTC = "0xfe18be6b3bd88a2d2a7f928d00292e7a9963cfc6"
# renBTC = "0xeb4c2781e4eba804ce9a9803c67d0893436bb27d"
# LPBTC = "0x28a8746e75304c0780E011BEd21C72cD78cd535E"
A_BTC = 0
_init_fee_BTC = 0
_admin_fee_BTC = 0

# USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"
# USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
# TUSD = "0x0000000000085d4780B73119b644AE5ecd22b376"
# DAI = "0x6b175474e89094c44da98b954eedeac495271d0f"
# LPUSD = "0x28a8746e75304c0780E011BEd21C72cD78cd535E"
A_USD = 0
_init_fee_USD = 0

# WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
# WETH1 = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
# LPETH = "0x28a8746e75304c0780E011BEd21C72cD78cd535E"
A_ETH = 0
_init_fee_ETH = 0
_admin_fee_ETH = 0

MAIN_TOKEN_NAME = "Main Token Name"
MAIN_TOKEN_SYMBOL = "Main Token Symbol"
MAIN_TOKEN_DECIMALS = 18

VOTING_ESCROW_NAME = "Voting Escrow Name"
VOTING_ESCROW_SYMBOL = "Voting Escrow Symbol"
VOTING_ESCROW_VERSION = "Voting Escrow V1"

USD_LP_TOKEN_NAME = "USD LP Token Name"
USD_LP_TOKEN_SYMBOL = "USD LP Token Symbol"
USD_LP_TOKEN_DECIMALS = 18
USD_LP_TOKEN_SUPPLY = 1000000e18

BTC_LP_TOKEN_NAME = "BTC LP Token Name"
BTC_LP_TOKEN_SYMBOL = "BTC LP Token Symbol"
BTC_LP_TOKEN_DECIMALS = 18
BTC_LP_TOKEN_SUPPLY = 1000000e18

ETH_LP_TOKEN_NAME = "ETH LP Token Name"
ETH_LP_TOKEN_SYMBOL = "ETH LP Token Symbol"
ETH_LP_TOKEN_DECIMALS = 18
ETH_LP_TOKEN_SUPPLY = 1000000e18

def main():

    # owner = accounts[0]
    owner = accounts.load('core_account')
    print(owner)

    mainToken = MainToken.deploy(MAIN_TOKEN_NAME, MAIN_TOKEN_SYMBOL, MAIN_TOKEN_DECIMALS, {'from': owner})
    #votingEscrow = VotingEscrow.deploy(mainToken.address, VOTING_ESCROW_NAME, VOTING_ESCROW_SYMBOL, VOTING_ESCROW_VERSION, {'from': owner})
    gaugeController = GaugeController.deploy({'from': owner})

    minter = Minter.deploy(mainToken.address, gaugeController.address, {'from': owner})

    wBTC = Token.deploy("wBTC Token", "wBTC", 18, 1e21, {'from': accounts[0]})
    sBTC = Token.deploy("sBTC Token", "sBTC", 18, 1e21, {'from': accounts[0]})
    renBTC = Token.deploy("renBTC Token", "renBTC", 18, 1e21, {'from': accounts[0]})

    USDT = Token.deploy("USDT Token", "USDT", 18, 1e21, {'from': accounts[0]})
    USDC = Token.deploy("USDC Token", "USDC", 18, 1e21, {'from': accounts[0]})
    TUSD = Token.deploy("TUSD Token", "TUSD", 18, 1e21, {'from': accounts[0]})
    DAI = Token.deploy("DAI Token", "DAI", 18, 1e21, {'from': accounts[0]})

    WETH = Token.deploy("WETH Token", "WETH", 18, 1e21, {'from': accounts[0]})
    WETH1 = Token.deploy("WETH1 Token", "WETH1", 18, 1e21, {'from': accounts[0]})

    usdLPToken = LPToken.deploy(USD_LP_TOKEN_NAME, USD_LP_TOKEN_SYMBOL, USD_LP_TOKEN_DECIMALS, USD_LP_TOKEN_SUPPLY, {'from': owner})
    btcLPToken = LPToken.deploy(BTC_LP_TOKEN_NAME, BTC_LP_TOKEN_SYMBOL, BTC_LP_TOKEN_DECIMALS, BTC_LP_TOKEN_SUPPLY, {'from': owner})
    ethLPToken = LPToken.deploy(ETH_LP_TOKEN_NAME, ETH_LP_TOKEN_SYMBOL, ETH_LP_TOKEN_DECIMALS, ETH_LP_TOKEN_SUPPLY, {'from': owner})

    usdPoolGauge = PoolGauge.deploy(usdLPToken.address, minter.address, {'from': owner})
    btcPoolGauge = PoolGauge.deploy(btcLPToken.address, minter.address, {'from': owner})
    ethPoolGauge = PoolGauge.deploy(ethLPToken.address, minter.address, {'from': owner})

    gaugeController.add_type("Pool Gauge1")
    gaugeController.add_type("Pool Gauge2")
    gaugeController.add_gauge(usdPoolGauge.address, 0, 1)
    gaugeController.add_gauge(btcPoolGauge.address, 1, 1)
    gaugeController.add_gauge(ethPoolGauge.address, 1, 1)

    btcPool = BTCPoolDelegator.deploy(owner, [wBTC.address, sBTC.address, renBTC.address], btcLPToken.address, A_BTC, _init_fee_BTC, _admin_fee_BTC, {'from': owner})
    usdPool = USDPoolDelegator.deploy([USDT.address, USDC.address, TUSD.address, DAI.address], [USDT.address, USDC.address, TUSD.address, DAI.address], usdLPToken.address, A_USD, _init_fee_USD, {'from': owner})
    ethPool = ETHPoolDelegator.deploy(owner, [WETH.address, WETH1.address], ethLPToken.address, A_ETH, _init_fee_ETH, _admin_fee_ETH, {'from': owner})

    testToken = Token.deploy("Test Token", "TST", 18, 1e21, {'from': accounts[0]})

    print('BOOT Token:       ', mainToken)
    print('GaugeController:  ', gaugeController)
    print('Minter:           ', minter)
    print('wBTC Test Token:  ', wBTC)
    print('sBTC Test Token:  ', sBTC)
    print('renBTC Test Token:', renBTC)
    print('USDT Test Token:  ', USDT)
    print('USDC Test Token:  ', USDC)
    print('TUSD Test Token:  ', TUSD)
    print('DAI Test Token:   ', DAI)
    print('WETH Test Token:  ', WETH)
    print('WETH1 Test Token: ', WETH1)
    print('USD LPToken:      ', usdLPToken)
    print('BTC LPToken:      ', btcLPToken)
    print('ETH LPToken:      ', ethLPToken)
    print('USD PoolGauge:    ', usdPoolGauge)
    print('BTC PoolGauge:    ', btcPoolGauge)
    print('ETH PoolGauge:    ', ethPoolGauge)
    print('USD Pool:         ', usdPool)
    print('BTC Pool:         ', btcPool)
    print('ETH Pool:         ', ethPool)

    return testToken
