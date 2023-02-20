import pytest
from brownie import chain
from brownie.test import strategy
from conftest import MIN_RAMP_TIME, ONE_DAY


class StateMachine:
    """
    Stateful test that performs a series of deposits, swaps and withdrawals
    and confirms that the virtual price only goes up.
    """

    st_pct = strategy("decimal", min_value="0.1", max_value="0.5", places=2)

    def __init__(self, admin, alice, swap, coins, decimals, liquidity):
        self.admin = admin
        self.alice = alice
        self.swap = swap
        self.coins = coins
        self.decimals = decimals
        self.n_coins = len(coins)
        self.liquidity = liquidity

    def setup(self):
        # reset the virtual price between each test run
        self.virtual_price = self.swap.getVirtualPrice()

    def _min_max(self):
        # get index values for the coins with the smallest and largest balances in the pool
        balances = [self.swap.getTokenBalance(i) / (10 ** self.decimals[i]) for i in range(self.n_coins)]
        min_idx = balances.index(min(balances))
        max_idx = balances.index(max(balances))
        if min_idx == max_idx:
            min_idx = abs(min_idx - 1)

        return min_idx, max_idx

    def rule_ramp_A(self, st_pct):
        """
        Increase the amplification coefficient.

        This action happens at most once per test. If A has already
        been ramped, a swap is performed instead.
        """
        new_A = int(self.swap.getA() * (1 + st_pct))
        self.swap.rampA(new_A, chain.time() + MIN_RAMP_TIME + 1, {"from": self.admin})

    def rule_ramp_A2(self, st_pct):
        """
        Increase the amplification coefficient.

        This action happens at most once per test. If A has already
        been ramped, a swap is performed instead.
        """
        new_A2 = int(self.swap.getA2() * (1 + st_pct))
        self.swap.rampA(new_A2, chain.time() + MIN_RAMP_TIME + 1, {"from": self.admin})

    def rule_exchange(self, st_pct):
        """
        Perform a swap using wrapped coins.
        """
        send, recv = self._min_max()
        amount = int(10 ** self.decimals[send] * st_pct)
        self.swap.swap(send, recv, amount, 0, chain.time() + 60, {"from": self.alice})

    def rule_remove_one_coin(self, st_pct):
        """
        Remove liquidity from the pool in only one coin.
        """
        idx = self._min_max()[1]
        amount = int(10 ** self.decimals[idx] * st_pct)
        self.swap.removeLiquidityOneToken(amount, idx, 0, chain.time() + 60, {"from": self.alice})

    def rule_remove_imbalance(self, st_pct):
        """
        Remove liquidity from the pool in an imbalanced manner.
        """
        idx = self._min_max()[1]
        amounts = [0] * self.n_coins
        amounts[idx] = int(10 ** self.decimals[idx] * st_pct)
        self.swap.removeLiquidityImbalance(amounts, self.liquidity.balanceOf(self.alice), chain.time() + 60, {"from": self.alice})

    def rule_remove(self, st_pct):
        """
        Remove liquidity from the pool.
        """
        amount = int(10 ** 18 * st_pct)
        self.swap.removeLiquidity(amount, [0] * self.n_coins, chain.time() + 60, {"from": self.alice})

    def invariant_check_virtual_price(self):
        """
        Verify that the pool's virtual price has either increased or stayed the same.
        """
        virtual_price = self.swap.getVirtualPrice()
        assert virtual_price >= self.virtual_price
        self.virtual_price = virtual_price

    def invariant_advance_time(self):
        """
        Advance the clock by 1 day between each action.
        """
        chain.sleep(ONE_DAY)


def test_number_always_go_up(
    add_initial_liquidity,
    state_machine,
    swap,
    admin,
    alice,
    coins,
    decimals,
    base_amount,
    liquidity
):
    swap.setSwapFee(10 ** 7)
    swap.setAdminFee(0)

    for coin in coins:
        amount = 10 ** 18 * base_amount
        coin._mint_for_testing(alice, amount, {"from": alice})

    liquidity.approve(swap, 2 ** 256 - 1, {"from": alice})

    state_machine(
        StateMachine,
        admin,
        alice,
        swap,
        coins,
        decimals,
        liquidity,
        settings={"max_examples": 5, "stateful_step_count": 25},
    )
