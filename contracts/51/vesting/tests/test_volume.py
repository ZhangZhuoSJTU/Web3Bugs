from brownie import chain
from brownie.test import strategy
from conftest import ONE_MONTH
import random


class VestingTracker:
    def __init__(self, account):
        self.account = account
        self.amount = 0
        self.claimed = 0
        self.time_last_check = 0

class StateMachine:
    """
    Stateful test that performs a series of deposits, swaps and withdrawals
    and confirms that the virtual price only goes up.
    """

    st_account = strategy("uint", min_value="1", max_value="9")
    st_pct = strategy("decimal", min_value="0.1", max_value="1.0", places=2)

    def __init__(self, admin, accounts, base_amount, token, Vesting):
        self.admin = admin
        self.accounts = accounts
        self.base_amount = base_amount
        self.token = token
        self.Vesting = Vesting

    def setup(self):
        self.contract = self.Vesting.deploy(self.token, self.admin, {"from": self.admin})
        self.token.approve(self.contract, self.token.balanceOf(self.admin), {"from": self.admin})
        self.vestings = {}
        i = 1 # skip admin accounts[0]
        while i < len(self.accounts):
            self.vestings[i] = VestingTracker(self.accounts[i])
            self.contract.vest(self.accounts[i], self.base_amount, 0, {"from": self.admin})
            self.vestings[i].amount = self.base_amount
            i += 1

    def invariant_advance_time(self):
        chain.sleep(ONE_MONTH)

    def rule_claim(self, st_account):
        vesting = self.vestings[st_account]
        if vesting.amount > vesting.claimed:
            now = chain.time()
            if now > vesting.time_last_check + ONE_MONTH:
                before = self.token.balanceOf(vesting.account)
                self.contract.claim({"from": vesting.account})
                after = self.token.balanceOf(vesting.account)
                claimed = after - before
                assert claimed > 0
                vesting.claimed += claimed
                vesting.time_last_check = now
                if vesting.amount == vesting.claimed:
                    print(vesting.account, 'fully vested')
                else:
                    print(vesting.account, 'claimed', vesting.claimed - claimed, '+', claimed, '=', vesting.claimed, '->', vesting.amount)

    def rule_vest(self, st_account, st_pct):
        vesting = self.vestings[st_account]
        amount = int(self.base_amount * st_pct)
        self.contract.vest(vesting.account, amount, 0, {"from": self.admin})
        print(vesting.account, 'vest', vesting.amount, '+', amount, '=', vesting.amount + amount)
        vesting.amount += amount
        vesting.time_last_check = chain.time()

def test_vest_claim(state_machine, admin, accounts, base_amount, token, Vesting):
    state_machine(
        StateMachine,
        admin,
        accounts,
        base_amount,
        token,
        Vesting,
        settings={"stateful_step_count": 25},
    )

