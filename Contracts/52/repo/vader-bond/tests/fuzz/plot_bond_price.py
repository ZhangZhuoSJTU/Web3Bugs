import brownie
from brownie import ZERO_ADDRESS

import matplotlib.pyplot as plt
import numpy as np

## Terms
CONTROL_VAR = 1e6
VESTING_TERM = 10000
MIN_PRICE = 0.1 * 1e6
MAX_PAYOUT = 1000
MAX_DEBT = 2 * 1e9 * 1e18
INITIAL_DEBT = 2 * 1e6 * 1e18
PAYOUT_TOTAL_SUPPLY = 2 * 1e6 * 1e18

## Adjustment
ADD = True
RATE = CONTROL_VAR * 3 / 100
TARGET = CONTROL_VAR * 2
BUFFER = 1


def test(chain, deployer, user, bond, treasury, principalToken, payoutToken):
    treasury.setBondContract(bond, True, {"from": deployer})

    bond.initializeBond(
        CONTROL_VAR,
        VESTING_TERM,
        MIN_PRICE,
        MAX_PAYOUT,
        MAX_DEBT,
        INITIAL_DEBT,
        {"from": deployer},
    )

    # TODO: use adjusment
    bond.setAdjustment(
        ADD,
        RATE,
        TARGET,
        BUFFER,
        {"from": deployer},
    )

    payoutToken.mint(treasury, PAYOUT_TOTAL_SUPPLY)

    principalToken.mint(user, 2 ** 256 - 1)
    principalToken.approve(bond, 2 ** 256 - 1, {"from": user})

    max_price = 2 ** 256 - 1

    block = 0

    blocks = []
    debt_ratios = []
    cvs = []
    prices = []

    def snapshot():
        debt_ratio = bond.debtRatio()
        price = bond.bondPrice()
        cv = bond.terms()["controlVariable"]
        # normalized
        print("block", block, debt_ratio / 1e18, price / 1e6, cv / 1e6)

        blocks.append(block)
        debt_ratios.append(debt_ratio / 1e18)
        prices.append(price / 1e6)
        cvs.append(cv / 1e6)

    for j in range(10):
        print("--- deposit ---")
        for i in range(10):
            snapshot()
            bond.deposit(1000 * 1e6, max_price, user, {"from": user})
            block += 1

        print("--- wait ---")
        for i in range(10):
            chain.mine(100)
            snapshot()
            block += 100

    plt.plot(blocks, prices, label="price")
    plt.plot(blocks, debt_ratios, label="debt ratio")
    plt.plot(blocks, cvs, label="control var")
    plt.legend()
    plt.savefig("bond-price.png")
