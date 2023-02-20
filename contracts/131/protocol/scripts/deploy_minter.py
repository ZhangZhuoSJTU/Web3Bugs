from brownie import Controller, Controller, Minter  # type: ignore

from support.utils import (
    get_deployer,
    make_tx_params,
    with_deployed,
    with_gas_usage,
)


@with_gas_usage
@with_deployed(Controller)
def main(controller):
    annualInflationRateLp = 60_129_542 * 1e18 * 0.7
    annualInflationRateAmm = 60_129_542 * 1e18 * 0.1
    annualInflationRateKeeper = 60_129_542 * 1e18 * 0.2
    annualInflationDecayLp = 0.6 * 1e18
    annualInflationDecayKeeper = 0.4 * 1e18
    annualInflationDecayAmm = 0.4 * 1e18
    initialPeriodKeeperInflation = 500_000 * 1e18
    initialPeriodAmmInflation = 500_000 * 1e18
    non_inflation_distribution = 118_111_600 * 1e18
    deployer = get_deployer()
    minter = deployer.deploy(
        Minter,
        annualInflationRateLp,
        annualInflationRateKeeper,
        annualInflationRateAmm,
        annualInflationDecayLp,
        annualInflationDecayKeeper,
        annualInflationDecayAmm,
        initialPeriodKeeperInflation,
        initialPeriodAmmInflation,
        non_inflation_distribution,
        controller,
        **make_tx_params(),  # type: ignore
    )
    return minter
