import time

from brownie import accounts, network, MyStrategy, SettV3, BadgerRegistry

from config import WANT, REWARD_TOKEN, LP_COMPONENT, REGISTRY

from helpers.constants import AddressZero

import click
from rich.console import Console

console = Console()

sleep_between_tx = 1


def main():
    """
    TO BE RUN BEFORE PROMOTING TO PROD

    Checks and Sets all Keys for Vault and Strategy Against the Registry

    1. Checks all Keys
    2. Sets all Keys

    In case of a mismatch, the script will execute a transaction to change the parameter to the proper one.

    Notice that, as a final step, the script will change the governance address to Badger's Governance Multisig;
    this will effectively relinquish the contract control from your account to the Badger Governance.
    Additionally, the script performs a final check of all parameters against the registry parameters.
    """

    # Get deployer account from local keystore
    dev = connect_account()

    # Add deployed Strategy and Vault contracts here:
    strategy = MyStrategy.at("0x809990849D53a5109e0cb9C446137793B9f6f1Eb")
    vault = SettV3.at("0x6B2d4c4bb50274c5D4986Ff678cC971c0260E967")

    assert strategy.paused() == False
    assert vault.paused() == False

    console.print("[blue]Strategy: [/blue]", strategy.getName())
    console.print("[blue]Vault: [/blue]", vault.name())

    # Get production addresses from registry
    registry = BadgerRegistry.at(REGISTRY)

    governance = registry.get("governance")
    guardian = registry.get("guardian")
    keeper = registry.get("keeper")
    controller = registry.get("controller")
    badgerTree = registry.get("badgerTree")

    assert governance != AddressZero
    assert guardian != AddressZero
    assert keeper != AddressZero
    assert controller != AddressZero
    assert badgerTree != AddressZero

    # Check production parameters and update any mismatch
    set_parameters(
        dev,
        strategy,
        vault,
        governance,
        guardian,
        keeper,
        controller,
    )

    # Confirm all productions parameters
    check_parameters(
        strategy, vault, governance, guardian, keeper, controller, badgerTree
    )


def set_parameters(dev, strategy, vault, governance, guardian, keeper, controller):
    # Set Controller (deterministic)
    if strategy.controller() != controller:
        strategy.setController(controller, {"from": dev})
        time.sleep(sleep_between_tx)
    if vault.controller() != controller:
        vault.setController(controller, {"from": dev})
        time.sleep(sleep_between_tx)

    console.print("[green]Controller existing or set at: [/green]", controller)

    # Set Fees
    if strategy.performanceFeeGovernance() != 1000:
        strategy.setPerformanceFeeGovernance(1000, {"from": dev})
        time.sleep(sleep_between_tx)
    if strategy.performanceFeeStrategist() != 1000:
        strategy.setPerformanceFeeStrategist(1000, {"from": dev})
        time.sleep(sleep_between_tx)
    if strategy.withdrawalFee() != 50:
        strategy.setWithdrawalFee(50, {"from": dev})
        time.sleep(sleep_between_tx)

    console.print("[green]Fees existing or set at: [/green]", "1000, 1000, 50")

    # Set permissioned accounts
    if strategy.keeper() != keeper:
        strategy.setKeeper(keeper, {"from": dev})
        time.sleep(sleep_between_tx)
    if vault.keeper() != keeper:
        vault.setKeeper(keeper, {"from": dev})
        time.sleep(sleep_between_tx)

    console.print("[green]Keeper existing or set at: [/green]", keeper)

    if strategy.guardian() != guardian:
        strategy.setGuardian(guardian, {"from": dev})
        time.sleep(sleep_between_tx)
    if vault.guardian() != guardian:
        vault.setGuardian(guardian, {"from": dev})
        time.sleep(sleep_between_tx)

    console.print("[green]Guardian existing or set at: [/green]", guardian)

    if strategy.strategist() != governance:
        strategy.setStrategist(governance, {"from": dev})
        time.sleep(sleep_between_tx)

    console.print("[green]Strategist existing or set at: [/green]", governance)

    if strategy.governance() != governance:
        strategy.setGovernance(governance, {"from": dev})
        time.sleep(sleep_between_tx)
    if vault.governance() != governance:
        vault.setGovernance(governance, {"from": dev})
        time.sleep(sleep_between_tx)

    console.print("[green]Governance existing or set at: [/green]", governance)


def check_parameters(
    strategy, vault, governance, guardian, keeper, controller, badgerTree
):
    assert strategy.want() == WANT
    assert vault.token() == WANT
    assert strategy.lpComponent() == LP_COMPONENT
    assert strategy.reward() == REWARD_TOKEN

    assert strategy.controller() == controller
    assert vault.controller() == controller

    assert strategy.performanceFeeGovernance() == 1000
    assert strategy.performanceFeeStrategist() == 1000
    assert strategy.withdrawalFee() == 50

    assert strategy.keeper() == keeper
    assert vault.keeper() == keeper
    assert strategy.guardian() == guardian
    assert vault.guardian() == guardian
    assert strategy.strategist() == governance
    assert strategy.governance() == governance
    assert vault.governance() == governance

    # Not all strategies use the badgerTree
    try:
        if strategy.badgerTree() != AddressZero:
            assert strategy.badgerTree() == badgerTree
    except:
        pass

    console.print("[blue]All Parameters checked![/blue]")


def connect_account():
    click.echo(f"You are using the '{network.show_active()}' network")
    dev = accounts.load(click.prompt("Account", type=click.Choice(accounts.load())))
    click.echo(f"You are using: 'dev' [{dev.address}]")
    return dev
