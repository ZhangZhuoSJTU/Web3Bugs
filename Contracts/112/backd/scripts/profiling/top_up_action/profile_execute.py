from brownie import ZERO_ADDRESS, StakerVault, Erc20Vault, Erc20Pool, LpToken, TopUpActionProfiler, Controller, DummyERC20, chain  # type: ignore

import os

from brownie.network.gas.strategies import LinearScalingStrategy
from support.constants import ADMIN_DELAY
from support.utils import get_deployer, get_treasury, make_tx_params
from support.convert import format_to_bytes
from scripts.deploy_pool_factory import deploy_pool_factory
from scripts.deploy_pool import deploy_pool
from scripts.deploy_top_up_action import deploy_top_up_action
from scripts.deploy_top_up_handler import deploy_mock_handler
from scripts.deploy_fee_bank import deploy_fee_bank
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
    vault = Erc20Vault.at(addrs["vault"])

    mockHandler = deploy_mock_handler()
    feeBank = deploy_fee_bank()
    topUpAction = deploy_top_up_action()

    vault.addAdmin(pool, {"from": deployer})
    pool.prepareNewVault(vault, {"from": deployer})
    chain.sleep(ADMIN_DELAY)
    pool.executeNewVault({"from": deployer})

    profiler = deployer.deploy(
        TopUpActionProfiler, topUpAction, lpToken, **make_tx_params()
    )
    token.transfer(profiler, 1000e18, {"from": deployer})

    token.approve(pool, 1000e18, {"from": deployer})
    pool.depositFor(profiler, 1000e18, 0, {"from": deployer})

    profiler.simpleRegister(
        profiler,
        format_to_bytes("Aave", 32),
        1.5e18,
        lpToken,
        1e18,
        token,
        1e18,
        1e18,
        False,
    )

    tx = profiler.profileExecute(
        profiler, profiler, deployer, format_to_bytes("Aave", 32)
    )

    print(tx.call_trace())
