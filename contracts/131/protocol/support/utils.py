from ctypes import Union
import os
import sys
from decimal import Decimal
from functools import lru_cache, wraps
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Optional, TypeVar, cast

from brownie import accounts, config, network, project
from brownie.network.account import ClefAccount, LocalAccount
from brownie.project.main import Project

from support.constants import (
    ADDRESSES,
    MAINNET_TREASURY_ADDRESS,
    KOVAN_TREASURY_ADDRESS,
    MAINNET_DEPLOYER_ADDRESS,
    STRATEGY_VAULT_ADDRESS,
    Addresses,
)
from support.convert import format_to_bytes

REQUIRED_CONFIRMATIONS = 1
DEV_CHAIN_IDS = {1337}
BROWNIE_PACKAGES_PATH = Path.home() / ".brownie" / "packages"
BROWNIE_GWEI = os.environ.get("BROWNIE_GWEI", "35")
BROWNIE_PRIORITY_GWEI = os.environ.get("BROWNIE_PRIORITY_GWEI")
BROWNIE_ACCOUNT_PASSWORD = os.environ.get("BROWNIE_ACCOUNT_PASSWORD")


T = TypeVar("T")


def scale(value, decimals=18):
    multiplier = 10**decimals
    return (Decimal(value) * multiplier).quantize(multiplier)


def is_live():
    return get_chain_id() not in DEV_CHAIN_IDS


def connect_to_clef():
    if not any(isinstance(acc, ClefAccount) for acc in accounts):
        print("Connecting to clef...")
        accounts.connect_to_clef()


def find_account(address: str) -> LocalAccount:
    matching = [acc for acc in accounts if acc.address == address]
    if not matching:
        raise ValueError(f"could not find account for {address}")
    return cast(LocalAccount, matching[0])


def get_clef_account(address: str):
    connect_to_clef()
    return find_account(address)


@lru_cache()
def get_deployer():
    chain_id = network.chain.id
    if not is_live():
        return accounts[0]
    if chain_id == 1111:  # live-mainnet-fork
        return find_account(MAINNET_DEPLOYER_ADDRESS)
    if chain_id == 1:  # mainnet
        return get_clef_account(MAINNET_DEPLOYER_ADDRESS)
    if chain_id == 42:  # kovan
        return cast(
            LocalAccount, accounts.load("kovan-deployer", BROWNIE_ACCOUNT_PASSWORD)
        )
    raise ValueError(f"chain id {chain_id} not yet supported")


@lru_cache()
def get_strategy_vault():
    if not is_live():
        return accounts[3].address
    if get_chain_id() == 1:  # mainnet
        return STRATEGY_VAULT_ADDRESS
    raise ValueError(f"chain id {get_chain_id()} not yet supported")


def get_treasury():
    chain_id = get_chain_id()
    if not is_live():
        return accounts[1].address
    if chain_id == 1:  # mainnet
        return MAINNET_TREASURY_ADDRESS
    if chain_id == 42:  # kovan
        return KOVAN_TREASURY_ADDRESS
    raise ValueError(f"chain id {get_chain_id()} not yet supported")


def make_tx_params():
    tx_params: Dict[str, Any] = {
        "required_confs": REQUIRED_CONFIRMATIONS,
    }
    if BROWNIE_PRIORITY_GWEI:
        tx_params["priority_fee"] = f"{BROWNIE_PRIORITY_GWEI} gwei"
    else:
        tx_params["gas_price"] = f"{BROWNIE_GWEI} gwei"
    return tx_params


def get_chain_id():
    chain_id = network.chain.id
    if chain_id == 1111:
        chain_id = 1
    return chain_id


def abort(reason, code=1):
    print(f"error: {reason}", file=sys.stderr)
    sys.exit(code)


def with_gas_usage(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        balance = get_deployer().balance()
        result = f(*args, **kwargs)
        gas_used = float(balance - get_deployer().balance()) / 1e18
        print(f"Gas used in deployment: {gas_used:.4f} ETH")
        return result

    return wrapper


def as_singleton(Contract):
    def wrapped(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if len(Contract) == 0:
                return f(*args, **kwargs)

            print(f"{Contract.deploy._name} already deployed, skipping")

        return wrapper

    return wrapped


def with_deployed(Contract):
    def wrapped(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if len(Contract) == 0:
                abort(f"{Contract.deploy._name} not deployed")

            contract = Contract[0]
            result = f(contract, *args, **kwargs)
            return result

        return wrapper

    return wrapped


def get_addresses() -> Addresses:
    chain_id = get_chain_id()
    if chain_id == 1111:
        chain_id = 1
    return ADDRESSES[chain_id]


def find(
    predicate: Callable[[T], bool], iterable: Iterable[T], message: Optional[str] = None
) -> T:
    for item in iterable:
        if predicate(item):
            return item
    if message is None:
        message = f"not found in {iterable}"
    raise ValueError(message)


def load_dependent_project(name: str) -> Project:
    dependency_name = find(lambda dep: f"{name}@" in dep, config["dependencies"])
    return project.load(BROWNIE_PACKAGES_PATH / dependency_name)  # type: ignore


def get_first_event(tx, event_name):
    for event in tx.events[event_name]:
        if event.address == tx.receiver:
            return event
    available_events = ", ".join(tx.events.keys())
    raise KeyError(
        f"event {event_name} not found, available events are: {available_events}"
    )


def encode_account(account, extra_data=None):
    if hasattr(account, "address"):
        account = account.address
    assert account.startswith("0x"), f"invalid account {account}"
    if extra_data is None:
        extra_data = "0" * 24
    if extra_data.startswith("0x"):
        extra_data = extra_data[2:]
    return account + extra_data
