import pytest
import brownie
from brownie import *
from helpers.constants import MaxUint256
from eth_utils import encode_hex

"""
  Tests against manual functions to ensure permissions are correctly set
"""


def test_check_manual_permissions(
    strategy, sett, governance, want, deployer, locker, strategist
):
    rando = accounts[6]

    ## Rando is bounced
    with brownie.reverts():
        strategy.reinvest({"from": rando})
    with brownie.reverts():
        strategy.manualProcessExpiredLocks({"from": rando})
    with brownie.reverts():
        strategy.manualDepositCVXIntoVault({"from": rando})
    with brownie.reverts():
        strategy.manualSendbCVXToVault({"from": rando})
    with brownie.reverts():
        strategy.manualRebalance(0, {"from": rando})

    ## Strategist is bounced for manual ops
    with brownie.reverts():
        strategy.reinvest({"from": strategist})
    with brownie.reverts():
        strategy.manualProcessExpiredLocks({"from": strategist})
    with brownie.reverts():
        strategy.manualDepositCVXIntoVault({"from": strategist})
    with brownie.reverts():
        strategy.manualSendbCVXToVault({"from": strategist})
    with brownie.reverts():
        strategy.manualRebalance(0, {"from": strategist})
