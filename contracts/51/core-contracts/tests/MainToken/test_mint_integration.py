import brownie
import pytest
from brownie.test import given, strategy

from tests.conftest import DAY, EPOCH, INFLATION_DELAY


@given(duration=strategy("uint", min_value=DAY, max_value=EPOCH))
def test_mint(admin, alice, chain, token, duration):
    token.set_minter(admin, {"from": admin})

    epoch_begin = token.start_epoch_time()

    chain.sleep(duration)
    chain.mine()

    rate = token.rate()
    initial_supply = token.totalSupply()

    elapsed = chain.time() - epoch_begin
    amount = rate * elapsed

    token.mint(alice, amount, {"from": admin})

    assert token.balanceOf(alice) == amount
    assert token.totalSupply() == initial_supply + amount


@given(duration=strategy("uint", min_value=4*3600, max_value=EPOCH))
def test_overmint(admin, alice, chain, token, duration):
    token.set_minter(admin, {"from": admin})

    epoch_begin = token.start_epoch_time()

    chain.sleep(duration)
    chain.mine()

    too_much = token.rate() * (60 + chain.time() - epoch_begin)

    with brownie.reverts("dev: exceeds allowable mint amount"):
        token.mint(alice, too_much, {"from": admin})


@given(durations=strategy("uint[5]", min_value=EPOCH * 0.33, max_value=EPOCH * 0.9))
def test_mint_multiple(admin, alice, chain, token, durations):
    token.set_minter(admin, {"from": admin})
    total_supply = token.totalSupply()
    balance = 0
    epoch_start = token.start_epoch_time()

    for time in durations:
        chain.sleep(time)

        if chain.time() - epoch_start > 60 + EPOCH:
            token.update_mining_parameters({"from": admin})
            epoch_start = token.start_epoch_time()

        amount = token.available_supply() - total_supply
        token.mint(alice, amount, {"from": admin})

        balance += amount
        total_supply += amount

        assert token.balanceOf(alice) == balance
        assert token.totalSupply() == total_supply
