"""Simple script to register a position in dev environment
This is to facilitate trying out the keeper
"""

from decimal import Decimal as D
from support.types import TopUpRecord
from support.utils import scale, with_deployed

from brownie import LpToken, TopUpAction, DummyERC20, Erc20Pool, Controller  # type: ignore
from brownie import accounts


TOTAL_DEPOSIT = 5_000
SINGLE_TOP_UP = 1_000
TOTAL_TOP_UP = 3_000
THRESHOLD = D("1.5")
PROTOCOL = "Aave"


@with_deployed(Controller)
@with_deployed(TopUpAction)
def main(top_up_action, controller):
    account = accounts[0]
    pool = Erc20Pool.at(controller.allPools()[0])
    underlying = DummyERC20.at(pool.getUnderlying())
    lp_token = LpToken.at(pool.lpToken())

    decimals = underlying.decimals()

    total_deposit = scale(TOTAL_DEPOSIT, decimals)
    single_top_up = scale(SINGLE_TOP_UP, decimals)
    total_top_up = scale(TOTAL_TOP_UP, decimals)
    max_fee = scale(5, 9)

    topup_count = (total_top_up + single_top_up - 1) // single_top_up
    eth_deposit = top_up_action.getEstimatedGasUsage() * max_fee * topup_count

    args = {"from": account}

    underlying.approve(pool, total_deposit, args)
    pool.deposit(total_deposit, args)

    protocols = top_up_action.getSupportedProtocols()
    protocol = [v for v in protocols if v.rstrip(b"\x00").decode() == PROTOCOL][0]

    lp_token.approve(top_up_action, total_top_up, args)
    tx = top_up_action.register(
        account,
        protocol,
        total_top_up,
        TopUpRecord(
            threshold=scale(THRESHOLD, 18),
            priorityFee=scale(1, 9),
            maxFee=max_fee,
            actionToken=underlying,
            depositToken=lp_token,
            singleTopUpAmount=single_top_up,
            totalTopUpAmount=total_top_up,
        ),
        {**args, "value": eth_deposit},
    )
    print("topup transaction,", tx, tx.status)
