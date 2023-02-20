import pytest
import brownie
from brownie import *
from helpers.constants import MaxUint256
from eth_utils import encode_hex

"""
  TODO: Put your tests here to prove the strat is good!
  See test_harvest_flow, for the basic tests
  See test_strategy_permissions, for tests at the permissions level
"""


def test_if_not_wait_withdrawal_reverts(setup_strat, sett, deployer):
    ## Try to withdraw all, fail because locked
    initial_dep = sett.balanceOf(deployer)

    with brownie.reverts():
        sett.withdraw(initial_dep, {"from": deployer})


def test_if_change_min_some_can_be_withdraw_easy(setup_strat, sett, deployer, want):

    initial_b = want.balanceOf(deployer)
    ## TODO / CHECK This is the ideal math but it seems to revert on me
    ## min = (sett.max() - sett.min() - 1) * sett.balanceOf(deployer) / 10000
    min = (sett.max() - sett.min() - 1) * sett.balanceOf(deployer) / 10000

    sett.withdraw(min, {"from": deployer})

    assert (
        want.balanceOf(deployer) > initial_b
    )  ## You can withdraw as long as it's less than min


def test_after_deposit_proxy_has_more_funds(
    locker, deployer, sett, strategy, want, staking
):
    """
    We have to check that Strategy Proy
    """
    proxy = locker.stakingProxy()

    initial_in_proxy = staking.balanceOf(proxy)

    # Setup
    startingBalance = want.balanceOf(deployer)
    depositAmount = startingBalance // 2
    assert startingBalance >= depositAmount
    assert startingBalance >= 0
    # End Setup
    # Deposit
    assert want.balanceOf(sett) == 0

    want.approve(sett, MaxUint256, {"from": deployer})
    sett.deposit(depositAmount, {"from": deployer})

    available = sett.available()
    assert available > 0

    sett.earn({"from": deployer})

    chain.sleep(10000 * 13)  # Mine so we get some interest

    ## TEST: Did the proxy get more want?
    assert staking.balanceOf(proxy) > initial_in_proxy


def test_delegation_was_correct(delegation_registry, strategy):
    target_delegate = strategy.DELEGATE()
    SPACE_ID = "0x6376782e65746800000000000000000000000000000000000000000000000000"
    status = delegation_registry.delegation(strategy, SPACE_ID)

    assert status == target_delegate
