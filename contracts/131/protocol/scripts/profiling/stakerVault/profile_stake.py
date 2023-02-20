from brownie import ZERO_ADDRESS, StakerVault, Erc20Pool, LpToken, StakerVaultProfiler, Controller, DummyERC20  # type: ignore

import os

from brownie.network.gas.strategies import LinearScalingStrategy
from support.utils import get_deployer, get_treasury, make_tx_params
from scripts.deploy_pool_factory import deploy_pool_factory
from scripts.deploy_pool import deploy_pool
from scripts.deploy_implementation import (
    erc20_pool,
    erc20_vault,
    eth_pool,
    eth_vault,
    lp_token,
    staker_vault,
)


def main():
    deployer = get_deployer()

    controller = deployer.deploy(
        Controller, get_treasury(), ZERO_ADDRESS, ZERO_ADDRESS, **make_tx_params()  # type: ignore
    )
    pool_factory = deploy_pool_factory()

    eth_vault()
    eth_pool()
    erc20_pool()
    erc20_vault()
    lp_token()
    staker_vault()

    token = deployer.deploy(DummyERC20, "Dai Stablecoin", "DAI", **make_tx_params())  # type: ignore
    token.mintAsOwner(100_000 * 10 ** 18)

    addrs = deploy_pool("bkddai")
    stakerVault = StakerVault.at(addrs["stakerVault"])
    lpToken = LpToken.at(addrs["lpToken"])
    pool = Erc20Pool.at(addrs["pool"])
    profiler = deployer.deploy(StakerVaultProfiler, stakerVault, **make_tx_params())
    token.approve(pool, 1000e18, {"from": deployer})
    pool.depositFor(profiler, 100e18, 0, {"from": deployer})

    tx = profiler.profileStake(1e18, {"from": deployer})
    print(tx.call_trace())
