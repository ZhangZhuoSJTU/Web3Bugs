from collections import deque
from enum import IntEnum

import pytest
from brownie import chain
from brownie.test import given, strategy
from hypothesis import settings

# number of gauges
GAUGE_COUNT = 100
# number of gauge types (distributed evenly across the gauges)
TYPE_COUNT = 5
# number of rounds per test - every gauge will be interacted with once per round
TEST_ROUNDS = 40
# number of times the test is run
TEST_RUNS = 1
# number of users in the test
USER_COUNT = 1000


class ActionEnum(IntEnum):
    """
    Enum of possible gauge actions in a test round.
    """

    vote = 0     # TODO
    deposit = 1
    withdraw = 2
    mint = 3
    noop = 4

    @classmethod
    def get_action(cls, value: int):
        value = len(cls) * value // (GAUGE_COUNT + 1)
        return cls(value)


@pytest.fixture(scope="module", autouse=True)
def setup(admin, accounts, gauge_controller, mock_lp_token, minter, token, voting_escrow):
    while len(accounts) < USER_COUNT:
        accounts.add()

    for i in range(2, len(accounts)):
        mock_lp_token.transfer(accounts[i], 10 ** 22, {"from": admin})
        #token.transfer(accounts[i], 10 ** 22, {"from": admin})
        #token.approve(voting_escrow, 10 ** 22, {"from": accounts[i]})
        #voting_escrow.create_lock(10 ** 22, chain.time() + 86400 * 365 * 2, {"from": accounts[i]})

    for i in range(TYPE_COUNT):
        gauge_controller.add_type(i, 10 ** 18, {"from": admin})


@pytest.fixture(scope="module")
def gauges(PoolGauge, admin, gauge_controller, mock_lp_token, minter, setup):
    # deploy `GAUGE_COUNT` gauges and return them as a list
    gauges = []
    for i in range(GAUGE_COUNT):
        contract = PoolGauge.deploy(mock_lp_token, minter, {"from": admin})
        gauge_controller.add_gauge(contract, i % TYPE_COUNT, {"from": admin})
        gauges.append(contract)

    return gauges


@pytest.mark.long
@given(st_actions=strategy(f"uint[{GAUGE_COUNT}]", max_value=GAUGE_COUNT, unique=True))
@settings(max_examples=TEST_RUNS)
def test_scalability(accounts, gauges, gauge_controller, mock_lp_token, minter, st_actions):

    # handle actions is a deque, so we can rotate it to ensure each gauge has multiple actions
    st_actions = deque(st_actions)

    # convert accounts to a deque so we can rotate it to evenly spread actions across accounts
    action_accounts = deque(accounts[2:])

    # for voting we use a seperate deque that only rotates once per test round
    # this way accounts never vote too often
    last_voted = deque(accounts)

    balances = {i: [0] * len(accounts) for i in gauges}

    for i in range(TEST_ROUNDS):
        print(f"Round {i}")
        # rotate voting account and actions
        last_voted.rotate()
        st_actions.rotate()

        # sleep just over a day between each round
        chain.sleep(86401)

        for gauge, action in zip(gauges, st_actions):
            action = ActionEnum.get_action(action)

            action_accounts.rotate()
            acct = action_accounts[0]
            idx = list(accounts).index(acct)

            if action == ActionEnum.vote:
                # TODO:
                # gauge_controller.vote_for_gauge_weights(gauge, 100, {"from": last_voted[0]})
                pass

            elif action == ActionEnum.deposit:
                mock_lp_token.approve(gauge, 10 ** 17, {"from": acct})
                gauge.deposit(10 ** 17, {"from": acct})
                balances[gauge][idx] += 10 ** 17

            elif action == ActionEnum.withdraw:
                amount = balances[gauge][idx]
                gauge.withdraw(amount, {"from": acct})
                balances[gauge][idx] = 0

            elif action == ActionEnum.mint:
                minter.mint(gauge, {"from": acct})
