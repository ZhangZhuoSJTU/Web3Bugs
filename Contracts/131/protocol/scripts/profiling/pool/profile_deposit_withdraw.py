from brownie import ZERO_ADDRESS, StakerVault, Erc20Vault, Erc20Pool, LpToken, LiquidityPoolProfiler, Controller, DummyERC20, chain  # type: ignore

import os

from brownie.network.gas.strategies import LinearScalingStrategy
from support.constants import ADMIN_DELAY
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
    # stakerVault = StakerVault.at(addrs["stakerVault"])
    lpToken = LpToken.at(addrs["lpToken"])
    pool = Erc20Pool.at(addrs["pool"])
    vault = Erc20Vault.at(addrs["vault"])
    profiler = deployer.deploy(LiquidityPoolProfiler, pool, token, **make_tx_params())
    token.transfer(profiler, 1000e18, {"from": deployer})
    # pool.depositFor(profiler, 100e18, 0, {"from": deployer})

    tx = profiler.profileDeposit(1e18, {"from": deployer})
    print("----------------Without vault---------------")
    print(tx.call_trace())

    vault.addAdmin(pool, {"from": deployer})
    pool.prepareNewVault(vault, {"from": deployer})
    chain.sleep(ADMIN_DELAY)
    pool.executeNewVault({"from": deployer})

    print("----------------With vault---------------")
    tx = profiler.profileDeposit(1e18, {"from": deployer})
    print(tx.call_trace())
