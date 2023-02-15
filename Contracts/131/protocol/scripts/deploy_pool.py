import json
import os

from brownie import ZERO_ADDRESS, PoolFactory, interface, network  # type: ignore
from brownie.project.main import get_loaded_projects
from support import constants
from support.convert import format_to_bytes
from support.utils import (
    abort,
    get_chain_id,
    get_deployer,
    make_tx_params,
    scale,
    with_deployed,
    with_gas_usage,
)

# deployment settings
# most settings are taken from `config/pools/{POOL_NAME}/pooldata.json`
POOL_NAME = os.environ.get("POOL_NAME")


# NOTE: order is critical for parameters so we define everything we need here
# following the order in the structs of `PoolFactory`
LP_TOKEN_ARGS = ["name", "symbol", "decimals"]
VAULT_ARGS = ["debtLimit", "targetAllocation", "bound"]
IMPLEMENTATION_NAMES = ["pool", "vault", "lpToken", "stakerVault"]


def _get_underlying_address(project, underlying):
    if underlying is None:
        return ZERO_ADDRESS
    elif "address" in underlying:
        return underlying["address"]
    else:
        contract_name = underlying["contract"]
        contract = getattr(project, contract_name)
        matching = [c.address for c in contract if c.symbol() == underlying["symbol"]]
        if len(matching) == 0:
            abort(f"{contract_name} not deployed")
        return matching[0]


@with_gas_usage
@with_deployed(PoolFactory)
def deploy_pool(pool_factory, pool_name):
    project = get_loaded_projects()[0]
    project_path = project._path
    assert project_path is not None

    data_path = project_path / "config" / "pools" / pool_name / "pooldata.json"
    if not data_path.exists():
        abort(f"not config found for pool {pool_name}")

    # load data about the deployment from `pooldata.json`
    with data_path.open() as fp:
        raw_pool_config = json.load(fp)

    pool_config = raw_pool_config["default"]
    chain_id = get_chain_id()
    override = raw_pool_config.get(str(chain_id), {})
    pool_config.update(override)

    underlying_address = _get_underlying_address(project, pool_config.get("underlying"))

    pool_type = "ETH" if underlying_address == ZERO_ADDRESS else "ERC20"
    implementations = {
        "stakerVault": constants.LATEST_STAKER_VAULT_IMPLEMENTATION_NAME,
        "lpToken": constants.LATEST_LP_TOKEN_IMPLEMENTATION_NAME,
        "pool": getattr(constants, f"LATEST_{pool_type}_POOL_IMPLEMENTATION_NAME"),
        "vault": getattr(constants, f"LATEST_{pool_type}_VAULT_IMPLEMENTATION_NAME"),
    }

    implementation_names = [
        format_to_bytes(implementations[key], 32) for key in IMPLEMENTATION_NAMES
    ]
    lp_token_args = [pool_config["lpToken"][key] for key in LP_TOKEN_ARGS]
    vault_args = [scale(pool_config["vault"][key]) for key in VAULT_ARGS]

    tx_params = {"from": get_deployer(), "gas_limit": 5 * 10**6, **make_tx_params()}
    decimals = (
        18
        if underlying_address == ZERO_ADDRESS
        else interface.ERC20(underlying_address).decimals()
    )
    tx = pool_factory.deployPool(
        pool_name,
        underlying_address,
        lp_token_args,
        vault_args,
        implementation_names,
        {"allow_revert": True, **tx_params},
    )
    addrs = tx.events["NewPool"]
    for name, addr in addrs.items():
        print(f"Deployed {name} at {addr}")

    return addrs


def main():
    if not POOL_NAME:
        abort("POOL_NAME env variable should be set")
    deploy_pool(POOL_NAME)  # type: ignore
