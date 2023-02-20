import pytest
from brownie import chain
from brownie.test import strategy

import decimal

pytestmark = pytest.mark.usefixtures("mintAlice", "approveAlice")

class StateMachine:
    """
    Stateful test that performs a series of pool/vault/strategy rebalances,
    top ups, deposits, withdrawals and strategy harvests on a backd pool and
    asserts that the exchange rate of the LP token only goes up.
    """

    st_pct = strategy("decimal", min_value="0.5", max_value="1", places=2)
    st_rates = strategy("decimal[8]", min_value="1.001", max_value="1.004", places=4, unique=True)
    st_reserve = strategy("decimal", min_value="0", max_value="1", places=2)
    st_alloc = strategy("decimal", min_value="0.75", max_value="1", places=2)

    def __init__(
        cls,
        alice,
        admin,
        pool,
        coin,
        vault,
        curveStrategy,
        decimals,
        curveCoins,
        curveSwap,
    ):
        cls.alice = alice
        cls.admin = admin
        cls.pool = pool
        cls.coin = coin
        cls.vault = vault
        cls.strategy = curveStrategy
        cls.decimals = decimals
        cls.curveCoins = curveCoins
        cls.curveSwap = curveSwap

        cls.curveDecimals = [curveCoin.decimals({"from": alice}) for curveCoin in cls.curveCoins]

        # approve backd pool for deposits
        coin.approve(cls.pool, 2 ** 256 - 1, {"from": cls.alice})
        # approve curve pool for swaps
        for curveCoin in cls.curveCoins:
            curveCoin.approve(cls.curveSwap, 2 ** 256 - 1, {"from": cls.alice})

    def setup(self):
        # reset the exchange rate between each test run
        self.exchangeRate = self.pool.exchangeRate()

    def rule_increase_rate(self, st_pct):
        """
        Increase the exchage rate of the pool.
        """
        amount = int(10 ** self.decimals * (1 + st_pct))
        self.coin.mint_for_testing(self.pool, amount, {"from": self.alice})

    def rule_update_pool_reserve_requirements(self, st_reserve):
        """
        Update the pool's required reserve ratio.
        """
        self.pool.setRequiredBackingReserveRatio(st_reserve * decimal.Decimal(1e18), {"from": self.admin})

    def rule_generate_curve_fees(self):
        """
        Generates trading fees on Curve by creating a big imbalance and then
        rebalancing the pool, which increases the virtual price.
        """
        balances = [self.curveSwap.balances(i) / (10 ** self.curveDecimals[i]) for i in range(len(self.curveCoins))]
        minIdx = balances.index(min(balances))
        maxIdx = balances.index(max(balances))
        if minIdx == maxIdx:
            minIdx = abs(minIdx - 1)

        dx = self.curveSwap.balances(maxIdx)
        decimals = self.curveDecimals
        if decimals[maxIdx] > decimals[minIdx]:
            dx = dx / 10 ** (decimals[maxIdx] - decimals[minIdx])
        elif decimals[minIdx] > decimals[maxIdx]:
            dx = dx * 10 ** (decimals[minIdx] - decimals[maxIdx])
        self.curveCoins[minIdx].mint_for_testing(self.alice, dx, {"from": self.alice})

        tx = self.curveSwap.exchange(minIdx, maxIdx, dx, 0, {"from": self.alice})
        dy = tx.events["TokenExchange"]["tokens_bought"]
        self.curveSwap.exchange(maxIdx, minIdx, dy, 0, {"from": self.alice})

    def rule_deposit(self, st_pct):
        """
        Deposit funds into pool.
        """
        amount = int(10 ** self.decimals * st_pct)
        self.pool.deposit(amount, {"from": self.alice})

    def invariant_check_exchange_rate(self):
        """
        Verify that pool's exchange rate increased or stayed the same.
        """
        exchangeRate = self.pool.exchangeRate()
        assert exchangeRate * (1 + 0.0001) >= self.exchangeRate
        self.exchangeRate = exchangeRate

    def invariant_advance_time(self):
        """
        Advance the clock by 1 hour between each action.
        """
        chain.sleep(3600)

@pytest.mark.skip_stateful
def test_rate_always_increases(
    state_machine,
    alice,
    admin,
    pool,
    coin,
    vault,
    strategy,
    curveCoins,
    curveSwap,
    decimals):
    # seed Curve pool with 1e6 per coin
    amounts = []
    for curveCoin in curveCoins:
        coinDecimals = curveCoin.decimals()
        initial_amount = 1000000 * 10 ** coinDecimals
        curveCoin.mint_for_testing(admin, initial_amount)
        curveCoin.approve(curveSwap, initial_amount, {"from": admin})
        amounts.append(initial_amount)
    curveSwap.add_liquidity(amounts, 0, {"from": admin})

    state_machine(
        StateMachine,
        alice,
        admin,
        pool,
        coin,
        vault,
        strategy,
        decimals,
        curveCoins,
        curveSwap,
        settings={"max_examples": 25, "stateful_step_count": 50},
    )
