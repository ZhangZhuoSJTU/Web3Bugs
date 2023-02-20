import brownie
from brownie import *
from helpers.constants import MaxUint256
from helpers.SnapshotManager import SnapshotManager
from helpers.time import days


def test_deposit_withdraw_single_user_flow(
    deployer, vault, controller, strategy, want, settKeeper, deployed
):
    # Setup
    snap = SnapshotManager(vault, strategy, controller, "StrategySnapshot")
    randomUser = accounts[6]
    # End Setup

    # Deposit
    assert want.balanceOf(deployer) > 0

    depositAmount = int(want.balanceOf(deployer) * 0.8)
    assert depositAmount > 0

    want.approve(vault.address, MaxUint256, {"from": deployer})

    snap.settDeposit(depositAmount, {"from": deployer})

    shares = vault.balanceOf(deployer)

    # Earn
    with brownie.reverts("onlyAuthorizedActors"):
        vault.earn({"from": randomUser})

    snap.settEarn({"from": settKeeper})

    chain.sleep(86400 * 250)  ## Wait 250 days so we can withdraw later
    chain.mine(1)

    strategy.manualRebalance(0, {"from": deployed.governance})

    snap.settWithdraw(shares // 2, {"from": deployer})

    chain.sleep(10000)
    chain.mine(1)

    snap.settWithdraw(shares // 2 - 1, {"from": deployer})


def test_single_user_harvest_flow(
    deployer,
    vault,
    sett,
    controller,
    strategy,
    want,
    settKeeper,
    strategyKeeper,
    deployed,
):
    # Setup
    snap = SnapshotManager(vault, strategy, controller, "StrategySnapshot")
    randomUser = accounts[6]
    tendable = strategy.isTendable()
    startingBalance = want.balanceOf(deployer)
    depositAmount = startingBalance // 2
    assert startingBalance >= depositAmount
    assert startingBalance >= 0
    # End Setup

    # Deposit
    want.approve(sett, MaxUint256, {"from": deployer})
    snap.settDeposit(depositAmount, {"from": deployer})
    shares = vault.balanceOf(deployer)

    assert want.balanceOf(sett) > 0
    print("want.balanceOf(sett)", want.balanceOf(sett))

    # Earn
    snap.settEarn({"from": settKeeper})

    if tendable:
        with brownie.reverts("onlyAuthorizedActors"):
            strategy.tend({"from": randomUser})

        snap.settTend({"from": strategyKeeper})

    chain.sleep(days(0.5))
    chain.mine()

    if tendable:
        snap.settTend({"from": strategyKeeper})

    chain.sleep(days(1))
    chain.mine()

    with brownie.reverts("onlyAuthorizedActors"):
        strategy.harvest({"from": randomUser})

    snap.settHarvest({"from": strategyKeeper})

    chain.sleep(86400 * 250)  ## Wait 250 days so we can withdraw later
    chain.mine()

    if tendable:
        snap.settTend({"from": strategyKeeper})

    strategy.manualRebalance(0, {"from": deployed.governance})

    snap.settWithdraw(shares // 2, {"from": deployer})

    chain.sleep(days(3))
    chain.mine()

    snap.settHarvest({"from": strategyKeeper})
    snap.settWithdraw(shares // 2 - 1, {"from": deployer})


def test_migrate_single_user(
    deployer, vault, sett, controller, strategy, want, strategist, deployed
):
    # Setup
    randomUser = accounts[6]
    snap = SnapshotManager(vault, strategy, controller, "StrategySnapshot")

    startingBalance = want.balanceOf(deployer)
    depositAmount = startingBalance // 2
    assert startingBalance >= depositAmount
    # End Setup

    # Deposit
    want.approve(sett, MaxUint256, {"from": deployer})
    snap.settDeposit(depositAmount, {"from": deployer})

    chain.sleep(15)
    chain.mine()

    sett.earn({"from": strategist})

    chain.snapshot()

    # Test no harvests
    chain.sleep(86400 * 250)  ## Wait 250 days so we can withdraw later
    chain.mine()

    before = {"settWant": want.balanceOf(sett), "stratWant": strategy.balanceOf()}

    with brownie.reverts():
        controller.withdrawAll(strategy.want(), {"from": randomUser})

    strategy.prepareWithdrawAll({"from": deployed.governance})
    controller.withdrawAll(strategy.want(), {"from": deployer})

    after = {"settWant": want.balanceOf(sett), "stratWant": strategy.balanceOf()}

    assert after["settWant"] >= before["settWant"]
    assert after["stratWant"] < before["stratWant"]
    assert after["stratWant"] == 0

    # Test tend only
    if strategy.isTendable():
        chain.revert()

        chain.sleep(days(2))
        chain.mine()

        strategy.tend({"from": deployer})

        before = {"settWant": want.balanceOf(sett), "stratWant": strategy.balanceOf()}

        with brownie.reverts():
            controller.withdrawAll(strategy.want(), {"from": randomUser})

        strategy.prepareWithdrawAll({"from": deployed.governance})
        controller.withdrawAll(strategy.want(), {"from": deployer})

        after = {"settWant": want.balanceOf(sett), "stratWant": strategy.balanceOf()}

        assert after["settWant"] >= before["settWant"]
        assert after["stratWant"] < before["stratWant"]
        assert after["stratWant"] == 0

    # Test harvest, with tend if tendable
    chain.revert()

    chain.sleep(days(1))
    chain.mine()

    if strategy.isTendable():
        strategy.tend({"from": deployer})

    chain.sleep(86400 * 250)  ## Wait 250 days so we can withdraw later
    chain.mine()

    before = {
        "settWant": want.balanceOf(sett),
        "stratWant": strategy.balanceOf(),
        "rewardsWant": want.balanceOf(controller.rewards()),
    }

    with brownie.reverts():
        controller.withdrawAll(strategy.want(), {"from": randomUser})

    strategy.prepareWithdrawAll({"from": deployed.governance})
    controller.withdrawAll(strategy.want(), {"from": deployer})

    after = {"settWant": want.balanceOf(sett), "stratWant": strategy.balanceOf()}

    assert after["settWant"] >= before["settWant"]
    assert after["stratWant"] < before["stratWant"]
    assert after["stratWant"] == 0


def test_withdraw_other(deployer, sett, controller, strategy, want):
    """
    - Controller should be able to withdraw other tokens
    - Controller should not be able to withdraw core tokens
    - Non-controller shouldn't be able to do either
    """
    # Setup
    randomUser = accounts[6]
    startingBalance = want.balanceOf(deployer)
    depositAmount = startingBalance // 2
    assert startingBalance >= depositAmount
    # End Setup

    # Deposit
    want.approve(sett, MaxUint256, {"from": deployer})
    sett.deposit(depositAmount, {"from": deployer})

    chain.sleep(86400 * 250)  ## Wait 250 days so we can withdraw later
    chain.mine()

    sett.earn({"from": deployer})

    chain.sleep(days(0.5))
    chain.mine()

    if strategy.isTendable():
        strategy.tend({"from": deployer})

    strategy.harvest({"from": deployer})

    chain.sleep(86400 * 250)  ## Wait 250 days so we can withdraw later
    chain.mine()

    mockAmount = Wei("1000 ether")
    mockToken = MockToken.deploy({"from": deployer})
    mockToken.initialize([strategy], [mockAmount], {"from": deployer})

    assert mockToken.balanceOf(strategy) == mockAmount

    # Should not be able to withdraw protected tokens
    protectedTokens = strategy.getProtectedTokens()
    for token in protectedTokens:
        with brownie.reverts():
            controller.inCaseStrategyTokenGetStuck(strategy, token, {"from": deployer})

    # Should send balance of non-protected token to sender
    controller.inCaseStrategyTokenGetStuck(strategy, mockToken, {"from": deployer})

    with brownie.reverts():
        controller.inCaseStrategyTokenGetStuck(
            strategy, mockToken, {"from": randomUser}
        )

    assert mockToken.balanceOf(controller) == mockAmount


def test_single_user_harvest_flow_remove_fees(
    deployer, vault, sett, controller, strategy, want, deployed
):
    # Setup
    randomUser = accounts[6]
    snap = SnapshotManager(vault, strategy, controller, "StrategySnapshot")
    startingBalance = want.balanceOf(deployer)
    tendable = strategy.isTendable()
    startingBalance = want.balanceOf(deployer)
    depositAmount = startingBalance // 2
    assert startingBalance >= depositAmount
    # End Setup

    # Deposit
    want.approve(sett, MaxUint256, {"from": deployer})
    snap.settDeposit(depositAmount, {"from": deployer})

    # Earn
    snap.settEarn({"from": deployer})

    chain.sleep(86400 * 250)  ## Wait 250 days so we can withdraw later
    chain.mine()

    if tendable:
        snap.settTend({"from": deployer})

    chain.sleep(86400 * 250)  ## Wait 250 days so we can withdraw later
    chain.mine()

    with brownie.reverts("onlyAuthorizedActors"):
        strategy.harvest({"from": randomUser})

    snap.settHarvest({"from": deployer})

    ## NOTE: Some strats do not do this, change accordingly
    assert want.balanceOf(controller.rewards()) > 0

    chain.sleep(86400 * 250)  ## Wait 250 days so we can withdraw later
    chain.mine()

    if tendable:
        snap.settTend({"from": deployer})

    chain.sleep(86400 * 250)  ## Wait 250 days so we can withdraw later
    chain.mine()

    strategy.prepareWithdrawAll({"from": deployed.governance})
    snap.settHarvest({"from": deployer})

    snap.settWithdrawAll({"from": deployer})

    endingBalance = want.balanceOf(deployer)

    print("Report after 4 days")
    print("Gains")
    print(endingBalance - startingBalance)
    print("gainsPercentage")
    print((endingBalance - startingBalance) / startingBalance)
