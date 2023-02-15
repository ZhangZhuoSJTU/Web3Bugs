import os
import json
from brownie import (
    Controller,
    Minter,
    AddressProvider,
    InflationManager,
    interface,
    RoleManager,
)
from support.constants import Roles  # type: ignore

from support.utils import (
    get_deployer,
    make_tx_params,
    with_deployed,
    with_gas_usage,
    scale,
)

# Specify the filename to read inflation settings from (this should be stores in config/inflation/)
INFLATION_FILE = os.environ.get("INFLATION_FILE")
assert INFLATION_FILE


@with_gas_usage
@with_deployed(RoleManager)
@with_deployed(AddressProvider)
@with_deployed(InflationManager)
@with_deployed(Minter)
def main(minter, inflation_manager, address_provider, role_manager):
    print(INFLATION_FILE)
    with open(INFLATION_FILE, "r") as f:
        inflation_settings = json.load(f)

    deployer = get_deployer()

    inflation_manager_interface = interface.IInflationManager(inflation_manager)

    role_manager.grantRole(
        Roles.INFLATION_MANAGER.value, deployer, {"from": deployer, **make_tx_params()}
    )

    pools = interface.IAddressProvider(address_provider).allPools()
    lp_tokens = [interface.ILiquidityPool(cur_pool).getLpToken() for cur_pool in pools]

    # Inflation settings for lps
    lp_weights = [
        scale(
            inflation_settings["lpInflation"][
                interface.IERC20Full(cur_lp_token).symbol()
            ]
        )
        for cur_lp_token in lp_tokens
    ]
    inflation_manager_interface.batchPrepareLpPoolWeights(
        lp_tokens, lp_weights, {"from": deployer, **make_tx_params()}
    )
    inflation_manager_interface.batchExecuteLpPoolWeights(
        lp_tokens, {"from": deployer, **make_tx_params()}
    )

    # Inflation settings for keepers
    keeper_weights = [
        scale(
            inflation_settings["keeperInflation"][
                interface.IERC20Full(cur_lp_token).symbol()
            ]
        )
        for cur_lp_token in lp_tokens
    ]
    inflation_manager_interface.batchPrepareKeeperPoolWeights(
        pools, keeper_weights, {"from": deployer, **make_tx_params()}
    )
    inflation_manager_interface.batchExecuteKeeperPoolWeights(
        pools, {"from": deployer, **make_tx_params()}
    )

    # Inflation settings for AMM lps
    amm_gauges = inflation_manager_interface.getAllAmmGauges()
    amm_tokens = [
        interface.IAmmGauge(amm_gauge).getAmmToken() for amm_gauge in amm_gauges
    ]
    amm_weights = [
        scale(
            inflation_settings["ammInflation"][interface.IERC20Full(amm_token).symbol()]
        )
        for amm_token in amm_tokens
    ]
    inflation_manager_interface.batchPrepareAmmTokenWeights(
        amm_tokens, amm_weights, {"from": deployer, **make_tx_params()}
    )
    inflation_manager_interface.batchExecuteAmmTokenWeights(
        amm_tokens, {"from": deployer, **make_tx_params()}
    )

    # Start inflation
    minter.startInflation({"from": deployer, **make_tx_params()})
