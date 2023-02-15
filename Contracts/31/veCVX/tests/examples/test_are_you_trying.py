from brownie import CvxStakingProxy, chain
from helpers.constants import MaxUint256


def test_are_you_trying(deployer, sett, strategy, want, locker):
    """
    Verifies that you set up the Strategy properly
    """
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

    chain.sleep(86400 * 250)  ## Wait 250 days so we can withdraw later

    ## TEST 1: Does the want get used in any way?
    assert want.balanceOf(sett) == depositAmount - available

    # Did the strategy do something with the asset?
    assert want.balanceOf(strategy) < available

    # Use this if it should invest all
    assert want.balanceOf(strategy) == 0

    CvxStakingProxy.at(locker.stakingProxy()).distribute({"from": deployer})

    ## TEST 2: Is the Harvest profitable?
    harvest = strategy.harvest({"from": deployer})
    event = harvest.events["Harvest"]
    # If it doesn't print, we don't want it
    assert event["harvested"] > 0
