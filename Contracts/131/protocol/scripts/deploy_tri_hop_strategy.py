import json
import os

from brownie import interface, BkdTriHopCvx, AddressProvider, ZERO_ADDRESS  # type: ignore
from brownie.project.main import get_loaded_projects
from support.mainnet_contracts import TokenAddresses


from support.utils import (
    abort,
    get_deployer,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)


@with_gas_usage
@with_deployed(AddressProvider)
def deploy_tri_hop_strategy(address_provider):
    tx_params = make_tx_params()
    STRATEGY = os.environ.get("STRATEGY")
    if not STRATEGY:
        abort("STRATEGY not set")
    deployer = get_deployer()

    ## Getting vault
    pools = interface.IAddressProvider(address_provider).allPools()
    vault = None
    for cur_pool in pools:
        pool = interface.ILiquidityPool(cur_pool)
        underlying = pool.getUnderlying()
        if underlying == ZERO_ADDRESS:
            continue
        if interface.IERC20Full(underlying).symbol().lower() == STRATEGY:
            vault = interface.IVault(pool.getVault())
            break
    if vault is None:
        raise ValueError("Vault not found.")

    ## Getting strategy config
    project = get_loaded_projects()[0]
    project_path = project._path
    assert project_path is not None
    data_path = project_path / "config" / "strategies" / STRATEGY / "strategydata.json"
    if not data_path.exists():
        abort(f"not config found for strategy {STRATEGY}")
    with data_path.open() as fp:
        strategy_config = json.load(fp)

    ## Deploying strategy
    strategy = deployer.deploy(
        BkdTriHopCvx,
        vault,
        deployer,
        strategy_config.get("convex_pid"),
        strategy_config.get("curve_pool"),
        strategy_config.get("curve_index"),
        strategy_config.get("curve_hop_pool"),
        strategy_config.get("curve_hop_index"),
        address_provider,
        **tx_params
    )

    ## Adding SPELL as additional reward token
    strategy.addRewardToken(TokenAddresses.SPELL, {"from": deployer, **tx_params})

    ## Adding strategy to vault
    vault.initializeStrategy(strategy, {"from": deployer, **tx_params})

    return strategy


def main():
    deploy_tri_hop_strategy()
