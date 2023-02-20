from brownie import ZERO_ADDRESS, Controller, ControllerProfiler  # type: ignore

from support.utils import get_deployer, get_treasury, make_tx_params


def main():
    deployer = get_deployer()
    controller = deployer.deploy(
        Controller, get_treasury(), ZERO_ADDRESS, ZERO_ADDRESS, **make_tx_params()  # type: ignore
    )
    profiler = deployer.deploy(ControllerProfiler, controller, **make_tx_params())
    controller.addAdmin(profiler)
    tx = profiler.profileIsAction(make_tx_params())
    print(tx.call_trace())
