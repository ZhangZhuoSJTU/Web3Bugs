import brownie
from brownie import *
from helpers.constants import MaxUint256, AddressZero
from helpers.SnapshotManager import SnapshotManager
from helpers.time import days


def state_setup(deployer, sett, controller, strategy, want):
    startingBalance = want.balanceOf(deployer)

    settKeeper = accounts.at(sett.keeper(), force=True)
    strategyKeeper = accounts.at(strategy.keeper(), force=True)

    tendable = strategy.isTendable()

    startingBalance = want.balanceOf(deployer)
    depositAmount = int(startingBalance * 0.8)
    assert startingBalance >= depositAmount
    want.approve(sett, MaxUint256, {"from": deployer})
    sett.deposit(depositAmount, {"from": deployer})

    chain.sleep(days(1))
    chain.mine()

    sett.earn({"from": settKeeper})

    chain.sleep(days(1))
    chain.mine()

    if tendable:
        strategy.tend({"from": strategyKeeper})

    strategy.harvest({"from": strategyKeeper})

    chain.sleep(days(1))
    chain.mine()

    accounts.at(deployer, force=True)
    accounts.at(strategy.governance(), force=True)
    accounts.at(strategy.strategist(), force=True)
    accounts.at(strategy.keeper(), force=True)
    accounts.at(strategy.guardian(), force=True)
    accounts.at(controller, force=True)


def test_strategy_action_permissions(deployer, sett, controller, strategy, want):
    state_setup(deployer, sett, controller, strategy, want)

    tendable = strategy.isTendable()

    randomUser = accounts[8]
    # End Setup

    # ===== Strategy =====
    authorizedActors = [
        strategy.governance(),
        strategy.keeper(),
    ]

    with brownie.reverts("onlyAuthorizedActorsOrController"):
        strategy.deposit({"from": randomUser})

    for actor in authorizedActors:
        strategy.deposit({"from": actor})

    # harvest: onlyAuthorizedActors
    with brownie.reverts("onlyAuthorizedActors"):
        strategy.harvest({"from": randomUser})

    for actor in authorizedActors:
        chain.sleep(10000 * 13)  ## 10k blocks per harvest
        strategy.harvest({"from": actor})

    # (if tendable) tend: onlyAuthorizedActors
    if tendable:
        with brownie.reverts("onlyAuthorizedActors"):
            strategy.tend({"from": randomUser})

        for actor in authorizedActors:
            strategy.tend({"from": actor})

    actorsToCheck = [
        randomUser,
        strategy.governance(),
        strategy.strategist(),
        strategy.keeper(),
    ]

    # withdrawAll onlyController
    for actor in actorsToCheck:
        with brownie.reverts("onlyController"):
            strategy.withdrawAll({"from": actor})

    # withdraw onlyController
    for actor in actorsToCheck:
        with brownie.reverts("onlyController"):
            strategy.withdraw(1, {"from": actor})

    # withdrawOther _onlyNotProtectedTokens
    for actor in actorsToCheck:
        with brownie.reverts("onlyController"):
            strategy.withdrawOther(controller, {"from": actor})


def test_strategy_config_permissions(strategy):
    randomUser = accounts[6]

    randomUser = accounts[8]
    # End Setup

    governance = strategy.governance()

    # Valid User should update
    strategy.setGuardian(AddressZero, {"from": governance})
    assert strategy.guardian() == AddressZero

    strategy.setWithdrawalFee(0, {"from": governance})
    assert strategy.withdrawalFee() == 0

    strategy.setPerformanceFeeStrategist(0, {"from": governance})
    assert strategy.performanceFeeStrategist() == 0

    strategy.setPerformanceFeeGovernance(0, {"from": governance})
    assert strategy.performanceFeeGovernance() == 0

    strategy.setController(AddressZero, {"from": governance})
    assert strategy.controller() == AddressZero

    # Invalid User should fail
    with brownie.reverts("onlyGovernance"):
        strategy.setGuardian(AddressZero, {"from": randomUser})

    with brownie.reverts("onlyGovernance"):
        strategy.setWithdrawalFee(0, {"from": randomUser})

    with brownie.reverts("onlyGovernance"):
        strategy.setPerformanceFeeStrategist(0, {"from": randomUser})

    with brownie.reverts("onlyGovernance"):
        strategy.setPerformanceFeeGovernance(0, {"from": randomUser})

    with brownie.reverts("onlyGovernance"):
        strategy.setController(AddressZero, {"from": randomUser})

    # Harvest:
    strategy.setPerformanceFeeGovernance(0, {"from": governance})
    assert strategy.performanceFeeGovernance() == 0

    strategy.setPerformanceFeeStrategist(0, {"from": governance})
    assert strategy.performanceFeeStrategist() == 0

    with brownie.reverts("onlyGovernance"):
        strategy.setPerformanceFeeGovernance(0, {"from": randomUser})

    with brownie.reverts("onlyGovernance"):
        strategy.setPerformanceFeeStrategist(0, {"from": randomUser})


def test_strategy_pausing_permissions(deployer, sett, controller, strategy, want):
    # Setup
    state_setup(deployer, sett, controller, strategy, want)
    randomUser = accounts[8]
    # End Setup

    authorizedPausers = [
        strategy.governance(),
        strategy.guardian(),
    ]

    authorizedUnpausers = [
        strategy.governance(),
    ]

    # pause onlyPausers
    for pauser in authorizedPausers:
        strategy.pause({"from": pauser})
        strategy.unpause({"from": authorizedUnpausers[0]})

    with brownie.reverts("onlyPausers"):
        strategy.pause({"from": randomUser})

    # unpause onlyPausers
    for unpauser in authorizedUnpausers:
        strategy.pause({"from": unpauser})
        strategy.unpause({"from": unpauser})

    with brownie.reverts("onlyGovernance"):
        strategy.unpause({"from": randomUser})

    strategy.pause({"from": strategy.guardian()})

    strategyKeeper = accounts.at(strategy.keeper(), force=True)

    with brownie.reverts("Pausable: paused"):
        sett.withdrawAll({"from": deployer})
    with brownie.reverts("Pausable: paused"):
        strategy.harvest({"from": strategyKeeper})
    if strategy.isTendable():
        with brownie.reverts("Pausable: paused"):
            strategy.tend({"from": strategyKeeper})

    strategy.unpause({"from": authorizedUnpausers[0]})


def test_sett_pausing_permissions(deployer, sett, controller, strategy, want):
    # Setup
    state_setup(deployer, sett, controller, strategy, want)
    randomUser = accounts[8]
    # End Setup

    assert sett.strategist() == AddressZero
    # End Setup

    authorizedPausers = [
        sett.governance(),
        sett.guardian(),
    ]

    authorizedUnpausers = [
        sett.governance(),
    ]

    # pause onlyPausers
    for pauser in authorizedPausers:
        sett.pause({"from": pauser})
        sett.unpause({"from": authorizedUnpausers[0]})

    with brownie.reverts("onlyPausers"):
        sett.pause({"from": randomUser})

    # unpause onlyPausers
    for unpauser in authorizedUnpausers:
        sett.pause({"from": unpauser})
        sett.unpause({"from": unpauser})

    sett.pause({"from": sett.guardian()})
    with brownie.reverts("onlyGovernance"):
        sett.unpause({"from": randomUser})

    settKeeper = accounts.at(sett.keeper(), force=True)

    with brownie.reverts("Pausable: paused"):
        sett.earn({"from": settKeeper})
    with brownie.reverts("Pausable: paused"):
        sett.withdrawAll({"from": deployer})
    with brownie.reverts("Pausable: paused"):
        sett.withdraw(1, {"from": deployer})
    with brownie.reverts("Pausable: paused"):
        sett.deposit(1, {"from": randomUser})
    with brownie.reverts("Pausable: paused"):
        sett.depositAll({"from": randomUser})

    sett.unpause({"from": authorizedUnpausers[0]})

    ## NOTE: Delete unpause checks as we test them elsewhere


def test_sett_config_permissions(deployer, sett, controller, strategy, want):
    state_setup(deployer, sett, controller, strategy, want)
    randomUser = accounts[8]
    assert sett.strategist() == AddressZero
    # End Setup

    # == Governance ==
    validActor = sett.governance()

    # setMin
    with brownie.reverts("onlyGovernance"):
        sett.setMin(0, {"from": randomUser})

    sett.setMin(0, {"from": validActor})
    assert sett.min() == 0

    # setController
    with brownie.reverts("onlyGovernance"):
        sett.setController(AddressZero, {"from": randomUser})

    sett.setController(AddressZero, {"from": validActor})
    assert sett.controller() == AddressZero

    # setStrategist
    with brownie.reverts("onlyGovernance"):
        sett.setStrategist(validActor, {"from": randomUser})

    sett.setStrategist(validActor, {"from": validActor})
    assert sett.strategist() == validActor

    with brownie.reverts("onlyGovernance"):
        sett.setKeeper(validActor, {"from": randomUser})

    sett.setKeeper(validActor, {"from": validActor})
    assert sett.keeper() == validActor


def test_sett_earn_permissions(deployer, sett, controller, strategy, want):
    # Setup
    state_setup(deployer, sett, controller, strategy, want)
    randomUser = accounts[8]
    assert sett.strategist() == AddressZero
    # End Setup

    # == Authorized Actors ==
    # earn

    authorizedActors = [
        sett.governance(),
        sett.keeper(),
    ]

    with brownie.reverts("onlyAuthorizedActors"):
        sett.earn({"from": randomUser})

    for actor in authorizedActors:
        chain.snapshot()
        sett.earn({"from": actor})
        chain.revert()
