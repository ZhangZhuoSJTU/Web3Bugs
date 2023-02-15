from brownie import Controller, AddressProvider, TopUpAction, TopUpActionFeeHandler, interface  # type: ignore
from brownie import AaveHandler, CompoundHandler, MockTopUpHandler, TopUpKeeperHelper, TopUpActionLibrary  # type: ignore

from support.utils import (
    get_deployer,
    as_singleton,
    is_live,
    make_tx_params,
    scale,
    with_deployed,
    with_gas_usage,
)
from support.convert import format_to_bytes

REQUIRED_CONFIRMATIONS = 1


@with_gas_usage
@as_singleton(TopUpAction)
@with_deployed(AddressProvider)
@with_deployed(Controller)
def deploy_top_up_action(controller, address_provider):
    deployer = get_deployer()
    print("deploying top up action")
    deployer.deploy(TopUpActionLibrary, **make_tx_params())
    topup_action = deployer.deploy(TopUpAction, controller, **make_tx_params())

    print("register top up action to controller")
    address_provider.addAction(topup_action, {"from": deployer, **make_tx_params()})

    print("deploying top up action fee handler")
    keeper_fee = scale("0.3")
    treasury_fee = scale("0.3")
    top_up_action_fee_handler = deployer.deploy(
        TopUpActionFeeHandler, controller, topup_action, keeper_fee, treasury_fee
    )

    protocols = [format_to_bytes("Aave", 32), format_to_bytes("Compound", 32)]
    if is_live():
        handlers = [AaveHandler[0], CompoundHandler[0]]
    else:
        handlers = [MockTopUpHandler[0]] * 2

    topup_action.initialize(top_up_action_fee_handler, protocols, handlers)

    # Add all tokens as usable by the topupaction
    pools = interface.IAddressProvider(address_provider).allPools()
    tokens = [interface.ILiquidityPool(pool).getLpToken() for pool in pools]
    for token in tokens:
        interface.IAction(topup_action).addUsableToken(
            token, {"from": deployer, **make_tx_params()}
        )
        print(token, " added as usable token to TopUpAction")

    deployer.deploy(TopUpKeeperHelper, TopUpAction[0])
    return topup_action


def main():
    deploy_top_up_action()  # type: ignore
