import os
from brownie import Controller, KeeperGauge, AddressProvider, InflationManager, TopUpAction, interface  # type: ignore

from support.utils import (
    get_deployer,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)

LP_TOKEN = os.environ.get("LP_TOKEN")
assert LP_TOKEN


@with_gas_usage
@with_deployed(Controller)
@with_deployed(AddressProvider)
@with_deployed(InflationManager)
@with_deployed(TopUpAction)
def main(top_up_action, inflation_manager, address_provider, controller):
    deployer = get_deployer()
    pools = interface.IAddressProvider(address_provider).allPools()

    pool = None
    for cur_pool in pools:
        cur_lp_token = interface.ILiquidityPool(cur_pool).getLpToken()
        if interface.IERC20Full(cur_lp_token).symbol() == LP_TOKEN:
            pool = cur_pool
            break
    if pool is None:
        raise ValueError("Pool not found.")

    keeper_gauge = deployer.deploy(KeeperGauge, controller, pool, **make_tx_params())  # type: ignore
    # Register the keeperGauge with the InflationManager
    interface.IInflationManager(inflation_manager).setKeeperGauge(
        pool, keeper_gauge, {"from": deployer, **make_tx_params()}
    )

    usable_tokens = interface.IAction(top_up_action).getUsableTokens()
    for token in usable_tokens:
        if LP_TOKEN == interface.IERC20Full(token).symbol():
            fee_handler = interface.IAction(top_up_action).getFeeHandler()
            interface.IActionFeeHandler(fee_handler).setInitialKeeperGaugeForToken(
                token, keeper_gauge, {"from": deployer, **make_tx_params()}
            )

    return keeper_gauge
