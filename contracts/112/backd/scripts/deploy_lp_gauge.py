import os
from brownie import interface, StakerVault, Controller, LpGauge, AddressProvider  # type: ignore

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
def main(address_provider, controller):
    deployer = get_deployer()
    pools = interface.IAddressProvider(address_provider).allPools()

    staker_vault = None
    for cur_pool in pools:
        cur_lp_token = interface.ILiquidityPool(cur_pool).getLpToken()
        if interface.IERC20Full(cur_lp_token).symbol() == LP_TOKEN:
            staker_vault = interface.IAddressProvider(address_provider).getStakerVault(
                cur_lp_token
            )
            break
    if staker_vault is None:
        raise ValueError("Lp token not found.")

    lp_gauge = deployer.deploy(LpGauge, controller, staker_vault, **make_tx_params())  # type: ignore
    # Set the lp_gauge for the StakerVault it belongs to
    interface.IStakerVault(staker_vault).initializeLpGauge(
        lp_gauge, {"from": deployer, **make_tx_params()}
    )
    return lp_gauge
