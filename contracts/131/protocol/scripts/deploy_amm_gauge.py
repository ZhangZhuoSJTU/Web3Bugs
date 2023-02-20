import os
from brownie import Controller, AmmGauge, InflationManager, DummyERC20  # type: ignore

from support.utils import (
    get_deployer,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)


AMM_TOKEN = os.environ.get("AMM_TOKEN")
assert AMM_TOKEN


@with_gas_usage
@with_deployed(Controller)
@with_deployed(InflationManager)
def main(inflation_manager, controller):
    deployer = get_deployer()

    amm_token = AMM_TOKEN
    if amm_token == "dummy":
        amm_token = deployer.deploy(
            DummyERC20, "TestAmmToken", "TAT", **make_tx_params()
        )
    amm_gauge = deployer.deploy(AmmGauge, controller, amm_token, **make_tx_params())  # type: ignore
    # register the amm gauge with the inflation manager
    inflation_manager.setAmmGauge(
        amm_token, amm_gauge, {"from": deployer, **make_tx_params()}
    )
    return amm_gauge
