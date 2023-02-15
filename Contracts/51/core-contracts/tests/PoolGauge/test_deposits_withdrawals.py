import brownie
from brownie import chain
from brownie.test import strategy


class StateMachine:
    """
    Validate that deposits and withdrawals work correctly over time.

    Strategies
    ----------
    st_account : Account
        Account to perform deposit or withdrawal from
    st_value : int
        Amount to deposit or withdraw
    st_time : int
        Amount of time to advance the clock
    """

    st_account = strategy("address", length=5)
    st_value = strategy("uint64")
    st_time = strategy("uint", max_value=86400 * 365)

    def __init__(self, accounts, pool_gauge, mock_lp_token):
        self.accounts = accounts
        self.token = mock_lp_token
        self.pool_gauge = pool_gauge

    def setup(self):
        self.balances = {i: 0 for i in self.accounts}

    def rule_deposit(self, st_account, st_value):
        """
        Make a deposit into the `LiquidityGauge` contract.

        Because of the upper bound of `st_value` relative to the initial account
        balances, this rule should never fail.
        """
        balance = self.token.balanceOf(st_account)

        self.pool_gauge.deposit(st_value, {"from": st_account})
        self.balances[st_account] += st_value

        assert self.token.balanceOf(st_account) == balance - st_value

    def rule_withdraw(self, st_account, st_value):
        """
        Attempt to withdraw from the `LiquidityGauge` contract.
        """
        if self.balances[st_account] < st_value:
            # fail path - insufficient balance
            with brownie.reverts():
                self.pool_gauge.withdraw(st_value, {"from": st_account})
            return

        # success path
        balance = self.token.balanceOf(st_account)
        self.pool_gauge.withdraw(st_value, {"from": st_account})
        self.balances[st_account] -= st_value

        assert self.token.balanceOf(st_account) == balance + st_value

    def rule_advance_time(self, st_time):
        """
        Advance the clock.
        """
        chain.sleep(st_time)

    def rule_checkpoint(self, st_account):
        """
        Create a new user checkpoint.
        """
        self.pool_gauge.user_checkpoint(st_account, {"from": st_account})

    def invariant_balances(self):
        """
        Validate expected balances against actual balances.
        """
        for account, balance in self.balances.items():
            assert self.pool_gauge.balanceOf(account) == balance

    def invariant_total_supply(self):
        """
        Validate expected total supply against actual total supply.
        """
        assert self.pool_gauge.totalSupply() == sum(self.balances.values())

    def teardown(self):
        """
        Final check to ensure that all balances may be withdrawn.
        """
        for account, balance in ((k, v) for k, v in self.balances.items() if v):
            initial = self.token.balanceOf(account)
            self.pool_gauge.withdraw(balance, {"from": account})

            assert self.token.balanceOf(account) == initial + balance


def test_state_machine(state_machine, accounts, pool_gauge, mock_lp_token, no_call_coverage):
    # fund accounts to be used in the test
    for acct in accounts[1:5]:
        mock_lp_token.transfer(acct, 10 ** 21, {"from": accounts[0]})

    # approve pool_gauge from the funded accounts
    for acct in accounts[:5]:
        mock_lp_token.approve(pool_gauge, 2 ** 256 - 1, {"from": acct})

    # because this is a simple state machine, we use more steps than normal
    settings = {"stateful_step_count": 25, "max_examples": 30}

    state_machine(StateMachine, accounts[:5], pool_gauge, mock_lp_token, settings=settings)
