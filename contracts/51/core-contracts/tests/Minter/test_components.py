import pytest
from brownie.test import given, strategy
from hypothesis import settings

from tests.conftest import approx, DAY, WEEK, YEAR, EPOCH, INFLATION_DELAY, advance_epochs


@pytest.fixture(scope="module", autouse=True)
def minter_setup(accounts, faucet, admin, mock_lp_token, gauge_controller, pool_gauge):
    gauge_controller.add_type(b"Liquidity", 10 ** 18, {"from": admin})
    gauge_controller.add_gauge(pool_gauge, 0, 10 ** 19, {"from": admin})

    # transfer tokens
    for acct in accounts[2:5]:
        mock_lp_token.transfer(acct, 1e18, {"from": admin})
        mock_lp_token.approve(pool_gauge, 1e18, {"from": acct})


@given(st_duration=strategy("uint[3]", min_value=1, max_value=4, unique=True))
@settings(max_examples=30)
def test_duration(accounts, boot, pool_gauge, minter, token, st_duration):
    accts = accounts[2:]

    deposit_time = []
    for i in range(3):
        tx = pool_gauge.deposit(10 ** 18, {"from": accts[i]})
        deposit_time.append(tx.timestamp)

    durations = []
    balances = []
    for i in range(3):
        advance_epochs(st_duration[i], boot)
        tx = pool_gauge.withdraw(10 ** 18, {"from": accts[i]})
        durations.append(tx.timestamp - deposit_time[i])
        minter.mint(pool_gauge, {"from": accts[i]})
        balances.append(token.balanceOf(accts[i]))

    total_minted = sum(balances)
    weight1 = durations[0]
    weight2 = weight1 + (durations[1] - durations[0]) * 1.5
    weight3 = weight2 + (durations[2] - durations[1]) * 3
    total_weight = weight1 + weight2 + weight3

    assert approx(balances[0] / total_minted, weight1 / total_weight, 5e-1)
    assert approx(balances[1] / total_minted, weight2 / total_weight, 5e-1)
    assert approx(balances[2] / total_minted, weight3 / total_weight, 5e-1)


@given(st_amounts=strategy("uint[3]", min_value=10 ** 17, max_value=10 ** 18, unique=True))
@settings(max_examples=30)
def test_amounts(accounts, chain, pool_gauge, minter, token, st_amounts):
    accts = accounts[2:]

    deposit_time = []
    for i in range(3):
        pool_gauge.deposit(st_amounts[i], {"from": accts[i]})
        deposit_time.append(chain[-1].timestamp)

    chain.sleep(5 * DAY)
    balances = []
    for i in range(3):
        pool_gauge.withdraw(st_amounts[i], {"from": accts[i]})

    for i in range(3):
        minter.mint(pool_gauge, {"from": accts[i]})
        balances.append(token.balanceOf(accts[i]))

    total_deposited = sum(st_amounts)
    total_minted = sum(balances)

    assert approx(balances[0] / total_minted, st_amounts[0] / total_deposited, 1e-4)
    assert approx(balances[1] / total_minted, st_amounts[1] / total_deposited, 1e-4)
    assert approx(balances[2] / total_minted, st_amounts[2] / total_deposited, 1e-4)
