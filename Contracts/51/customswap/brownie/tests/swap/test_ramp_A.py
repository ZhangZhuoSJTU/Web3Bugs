import brownie
import pytest
from conftest import MAX_A_CHANGE, MIN_RAMP_TIME, ONE_DAY, A_PRECISION
from brownie.test import given, strategy


@given(st_A=strategy("uint", min_value=0, max_value=2))
def test_ramp_A(chain, admin, swap_1, swap_10, swap_100, st_A):
    swap = [swap_1, swap_10, swap_100][st_A]

    initial_A = swap.swapStorage()['initialA'] // A_PRECISION
    future_time = chain.time() + 2 * MIN_RAMP_TIME

    tx = swap.rampA(initial_A * MAX_A_CHANGE, future_time, {"from": admin})

    assert swap.swapStorage()['initialA'] // A_PRECISION == initial_A
    assert swap.swapStorage()['futureA'] == initial_A * MAX_A_CHANGE * A_PRECISION
    assert swap.swapStorage()['initialATime'] == tx.timestamp
    assert swap.swapStorage()['futureATime'] == future_time


@given(st_A=strategy("uint", min_value=0, max_value=2))
def test_ramp_A_final(chain, admin, swap_1, swap_10, swap_100, st_A):
    swap = [swap_1, swap_10, swap_100][st_A]

    initial_A = swap.swapStorage()['initialA'] // A_PRECISION
    future_time = chain.time() + 2 * MIN_RAMP_TIME

    swap.rampA(initial_A * MAX_A_CHANGE, future_time, {"from": admin})

    chain.sleep(3 * MIN_RAMP_TIME)
    chain.mine()

    assert swap.getA() == initial_A * MAX_A_CHANGE


@given(st_A=strategy("uint", min_value=0, max_value=1))
def test_ramp_A_value_up(chain, admin, swap_1, swap_100, st_A):
    swap = [swap_1, swap_100][st_A]

    initial_A = swap.swapStorage()['initialA'] // A_PRECISION
    future_time = chain.time() + 2 * MIN_RAMP_TIME
    tx = swap.rampA(initial_A * MAX_A_CHANGE, future_time, {"from": admin})

    initial_time = tx.timestamp
    duration = future_time - tx.timestamp

    while chain.time() < future_time:
        chain.sleep(2 * ONE_DAY)
        chain.mine()
        expected = int(initial_A + ((chain.time() - initial_time) / duration) * initial_A)
        assert 0.999 < expected / swap.getA() <= 1.2

    chain.sleep(5) # TBD: This seems necessary to clean up otherwise next case fails with not enuf time
    chain.mine()


@given(st_A=strategy("uint", min_value=0, max_value=1))
def test_ramp_A_value_down(chain, admin, swap, swap_100, swap_1000, st_A):
    swap = [swap_100, swap_1000][st_A]

    initial_A = swap.swapStorage()['initialA'] // A_PRECISION
    final_A = initial_A // MAX_A_CHANGE
    future_time = chain.time() + 2 * MIN_RAMP_TIME
    tx = swap.rampA(final_A, future_time, {"from": admin})

    initial_time = tx.timestamp
    duration = future_time - tx.timestamp

    while chain.time() < future_time:
        chain.sleep(2 * ONE_DAY)
        chain.mine()
        expected = int(initial_A - ((chain.time() - initial_time) / duration) * (initial_A - final_A))
        if expected == 0:
            assert swap.getA() == final_A
        else:
            assert 0.999 < swap.getA() / expected <= 1.2


@given(st_A=strategy("uint", min_value=0, max_value=1))
def test_stop_ramp_A(chain, admin, swap_1, swap_100, st_A):
    swap = [swap_1, swap_100][st_A]

    initial_A = swap.swapStorage()['initialA'] // A_PRECISION
    future_time = chain.time() + 2 * MIN_RAMP_TIME
    swap.rampA(initial_A * MAX_A_CHANGE, future_time, {"from": admin})

    chain.sleep(ONE_DAY)

    tx_stop = swap.stopRampA({"from": admin})

    current_A = swap.getA()

    chain.sleep(ONE_DAY)
    chain.sleep(ONE_DAY)
    chain.sleep(ONE_DAY)

    assert swap.swapStorage()['initialA'] // A_PRECISION == current_A
    assert swap.swapStorage()['futureA'] // A_PRECISION == current_A
    assert swap.swapStorage()['initialATime'] == tx_stop.timestamp
    assert swap.swapStorage()['futureATime'] == tx_stop.timestamp


def test_ramp_A_only_owner(chain, bob, swap):
    with brownie.reverts("Ownable: caller is not the owner"):
        swap.rampA(0, chain.time() + 2 * MIN_RAMP_TIME, {"from": bob})


def test_ramp_A_insufficient_time(chain, alice, swap):
    with brownie.reverts("Ownable: caller is not the owner"):
        swap.rampA(0, chain.time() + 2 * MIN_RAMP_TIME, {"from": alice})


def test_stop_ramp_A_only_owner(chain, bob, swap):
    with brownie.reverts("Ownable: caller is not the owner"):
        swap.stopRampA({"from": bob})
