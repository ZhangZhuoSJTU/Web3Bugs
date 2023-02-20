import time

from brownie import (
    accounts,
    network,
    Controller,
    BadgerRegistry,
)

import click
from rich.console import Console

from config import REGISTRY

from helpers.constants import AddressZero

console = Console()

sleep_between_tx = 1


def main():
    """
    GOVERNANCE ONLY
    Connects the Strategies to the Vaults via the Production Controller

    This script is enabled to handle multiple sets of strategy + vault + want. It must be
    called from the controller's governance account.
    """

    # dev must be the controller's governance (get from keystore)
    dev = connect_account()

    # NOTE: Add the strategies, vaults and their corresponding wants
    # to the arrays below. It is very important that indexes are the
    # same for corresponding contracts. Example: to wire SettA, the
    # address of strategyA, vaultA and wantA must all be position at
    # the same index within their respective arrays.

    # Strategies to wire up
    strategies = [
        "0x1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a",
    ]
    # Vaults to wire up
    vaults = [
        "0x1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a",
    ]
    # Wants related to strategies and vaults
    wants = [
        "0x1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a",
    ]

    # Get production controller from registry
    registry = BadgerRegistry.at(REGISTRY)
    controllerAddr = registry.get("controller")
    assert controllerAddr != AddressZero
    controller = Controller.at(controllerAddr)

    # Wire up strategies
    for strat in strategies:
        want = wants[strategies.index(strat)]

        controller.approveStrategy(want, strat, {"from": dev})
        time.sleep(sleep_between_tx)
        assert controller.approvedStrategies(want, strat) == True

        controller.setStrategy(want, strat, {"from": dev})
        time.sleep(sleep_between_tx)
        assert controller.strategies(want) == strat

    # Wire up vaults
    for vault in vaults:
        want = wants[vaults.index(vault)]

        controller.setVault(want, vault, {"from": dev})
        time.sleep(sleep_between_tx)
        assert controller.vaults(want) == vault


def connect_account():
    click.echo(f"You are using the '{network.show_active()}' network")
    dev = accounts.load(click.prompt("Account", type=click.Choice(accounts.load())))
    click.echo(f"You are using: 'dev' [{dev.address}]")
    return dev
