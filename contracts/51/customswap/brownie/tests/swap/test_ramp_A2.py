import brownie
import pytest
from conftest import MAX_A_CHANGE, MIN_RAMP_TIME, ONE_DAY, A_PRECISION
from brownie.test import given, strategy


@given(st_A=strategy("uint", min_value=0, max_value=2))
def test_ramp_A(chain, admin, swap_1, swap_10, swap_100, st_A):
    swap = [swap_1, swap_10, swap_100][st_A]

    initial_A2 = swap.swapStorage()['initialA2'] // A_PRECISION
    future_time = chain.time() + MIN_RAMP_TIME + 5

    tx = swap.rampA2(initial_A2 * MAX_A_CHANGE, future_time, {"from": admin})

    assert swap.swapStorage()['initialA2'] // A_PRECISION == initial_A2
    assert swap.swapStorage()['futureA2'] == initial_A2 * MAX_A_CHANGE * A_PRECISION
    assert swap.swapStorage()['initialA2Time'] == tx.timestamp
    assert swap.swapStorage()['futureA2Time'] == future_time


@given(st_A=strategy("uint", min_value=0, max_value=2))
def test_ramp_A_final(chain, admin, swap_1, swap_10, swap_100, st_A):
    swap = [swap_1, swap_10, swap_100][st_A]

    initial_A2 = swap.swapStorage()['initialA2'] // A_PRECISION
    future_time = chain.time() + MIN_RAMP_TIME + 5

    swap.rampA2(initial_A2 * MAX_A_CHANGE, future_time, {"from": admin})

    chain.sleep(MIN_RAMP_TIME + 5)
    chain.mine()

    assert swap.getA2() == initial_A2 * MAX_A_CHANGE


@given(st_A=strategy("uint", min_value=0, max_value=1))
def test_ramp_A_value_up(chain, admin, swap_1, swap_100, st_A):
    swap = [swap_1, swap_100][st_A]

    initial_A2 = swap.swapStorage()['initialA2'] // A_PRECISION
    future_time = chain.time() + 2 * MIN_RAMP_TIME
    tx = swap.rampA2(initial_A2 * MAX_A_CHANGE, future_time, {"from": admin})

    initial_time = tx.timestamp
    duration = future_time - tx.timestamp

    while chain.time() < future_time:
        chain.sleep(2 * ONE_DAY)
        chain.mine()
        expected = int(initial_A2 + ((chain.time() - initial_time) / duration) * initial_A2)
        assert 0.999 < expected / swap.getA2() <= 1.2

    chain.sleep(5) # TBD: This seems necessary to clean up otherwise next case fails with not enuf time
    chain.mine()


@given(st_A=strategy("uint", min_value=0, max_value=1))
def test_ramp_A_value_down(chain, admin, swap, swap_100, swap_1000, st_A):
    swap = [swap_100, swap_1000][st_A]

    initial_A2 = swap.swapStorage()['initialA2'] // A_PRECISION
    final_A2 = initial_A2 // MAX_A_CHANGE
    future_time = chain.time() + 2 * MIN_RAMP_TIME
    tx = swap.rampA2(final_A2, future_time, {"from": admin})

    initial_time = tx.timestamp
    duration = future_time - tx.timestamp

    while chain.time() < future_time:
        chain.sleep(2 * ONE_DAY)
        chain.mine()
        expected = int(initial_A2 - ((chain.time() - initial_time) / duration) * (initial_A2 - final_A2))
        if expected == 0:
            assert swap.getA2() == final_A2
        else:
            assert 0.999 < swap.getA2() / expected <= 1.2


@given(st_A=strategy("uint", min_value=0, max_value=1))
def test_stop_ramp_A(chain, admin, swap_1, swap_100, st_A):
    swap = [swap_1, swap_100][st_A]

    initial_A2 = swap.swapStorage()['initialA2'] // A_PRECISION
    future_time = chain.time() + MIN_RAMP_TIME
    swap.rampA2(initial_A2 * MAX_A_CHANGE, future_time, {"from": admin})

    chain.sleep(ONE_DAY)

    tx_stop = swap.stopRampA2({"from": admin})

    current_A2 = swap.getA2()

    chain.sleep(ONE_DAY)
    chain.sleep(ONE_DAY)
    chain.sleep(ONE_DAY)

    assert swap.swapStorage()['initialA2'] // A_PRECISION == current_A2
    assert swap.swapStorage()['futureA2'] // A_PRECISION == current_A2
    assert swap.swapStorage()['initialA2Time'] == tx_stop.timestamp
    assert swap.swapStorage()['futureA2Time'] == tx_stop.timestamp


def test_ramp_A2_only_owner(chain, bob, swap):
    with brownie.reverts("Ownable: caller is not the owner"):
        swap.rampA2(0, chain.time() + MIN_RAMP_TIME, {"from": bob})


def test_ramp_A2_insufficient_time(chain, alice, swap):
    with brownie.reverts("Ownable: caller is not the owner"):
        swap.rampA2(0, chain.time() + MIN_RAMP_TIME - 1, {"from": alice})


def test_stop_ramp_A2_only_owner(chain, bob, swap):
    with brownie.reverts("Ownable: caller is not the owner"):
        swap.stopRampA2({"from": bob})
