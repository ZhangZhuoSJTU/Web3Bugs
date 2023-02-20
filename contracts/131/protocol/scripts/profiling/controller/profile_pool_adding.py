from brownie import ZERO_ADDRESS, StakerVault, Erc20Vault, Erc20Pool, LpToken, ControllerProfiler, Controller, DummyERC20, chain  # type: ignore

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

    lpToken = LpToken.at(addrs["lpToken"])
    pool = Erc20Pool.at(addrs["pool"])

    profiler = deployer.deploy(ControllerProfiler, controller, **make_tx_params())
    controller.addAdmin(profiler)
    tx = profiler.profilePoolAddingAndLpTokenGet(pool, lpToken, make_tx_params())
    print(tx.call_trace())
