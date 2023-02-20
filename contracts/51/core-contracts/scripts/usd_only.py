#!/usr/bin/python3

from brownie import Token, \
                    USDPoolDelegator, \
                    GaugeController, \
                    MainToken, \
                    VotingEscrow, \
                    Minter, \
                    LPToken, \
                    PoolGauge, \
                    accounts


A_USD = 100
_init_fee_USD = 0


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

def main():

    # owner = accounts[0]
    owner = accounts.load('core_account')
    print(owner)

    mainToken = MainToken.deploy(MAIN_TOKEN_NAME, MAIN_TOKEN_SYMBOL, MAIN_TOKEN_DECIMALS, {'from': owner})
    #votingEscrow = VotingEscrow.deploy(mainToken.address, VOTING_ESCROW_NAME, VOTING_ESCROW_SYMBOL, VOTING_ESCROW_VERSION, {'from': owner})
    gaugeController = GaugeController.deploy({'from': owner})
    minter = Minter.deploy(mainToken.address, gaugeController.address, {'from': owner})

    USDT = Token.deploy("USDT Token", "USDT", 18, 1e21, {'from': accounts[0]})
    USDC = Token.deploy("USDC Token", "USDC", 18, 1e21, {'from': accounts[0]})
    TUSD = Token.deploy("TUSD Token", "TUSD", 18, 1e21, {'from': accounts[0]})
    DAI = Token.deploy("DAI Token", "DAI", 18, 1e21, {'from': accounts[0]})

    usdLPToken = LPToken.deploy(USD_LP_TOKEN_NAME, USD_LP_TOKEN_SYMBOL, USD_LP_TOKEN_DECIMALS, USD_LP_TOKEN_SUPPLY, {'from': owner})

    usdPoolGauge = PoolGauge.deploy(usdLPToken.address, minter.address, {'from': owner})

    gaugeController.add_type("Pool Gauge1")
    gaugeController.add_type("Pool Gauge2")
    gaugeController.add_gauge(usdPoolGauge.address, 0, 1)

    usdPool = USDPoolDelegator.deploy([USDT.address, USDC.address, TUSD.address, DAI.address], [USDT.address, USDC.address, TUSD.address, DAI.address], usdLPToken.address, A_USD, _init_fee_USD, {'from': owner})

    testToken = Token.deploy("Test Token", "TST", 18, 1e21, {'from': accounts[0]})

    print('BOOT Token:     ', mainToken)
    print('GaugeController:', gaugeController)
    print('Minter:         ', minter)
    print('USDT Test Token:', USDT)
    print('USDC Test Token:', USDC)
    print('TUSD Test Token:', TUSD)
    print('DAI Test Token: ', DAI)
    print('USD LPToken:    ', usdLPToken)
    print('USD PoolGauge:  ', usdPoolGauge)
    print('USD Pool:       ', usdPool)

    return testToken
