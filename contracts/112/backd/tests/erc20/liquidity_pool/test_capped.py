from brownie.test.managers.runner import RevertContextManager as reverts
import pytest
from support.contract_utils import update_topup_handler
from support.types import TopUpRecord

from support.utils import encode_account, scale


PROTOCOL_1_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"

pytestmark = pytest.mark.usefixtures("registerSetUp")


@pytest.fixture
def registerSetUp(
    address_provider, topUpAction, admin, chain, cappedPool, mockTopUpHandler
):
    address_provider.addPool(cappedPool, {"from": admin})
    update_topup_handler(
        topUpAction, PROTOCOL_1_ADDRESS, mockTopUpHandler, chain, admin
    )


def test_cap(alice, charlie, decimals, cappedPool, coin):
    coin.mint_for_testing(alice, scale(100, decimals))
    coin.approve(cappedPool, scale(100, decimals), {"from": alice})
    cappedPool.deposit(scale(10, decimals), {"from": alice})
    cappedPool.deposit(scale(10, decimals), {"from": alice})
    with reverts("deposit exceeds deposit cap"):
        cappedPool.deposit(scale(10, decimals), {"from": alice})
    coin.mint_for_testing(charlie, scale(100, decimals))
    coin.approve(cappedPool, scale(100, decimals), {"from": charlie})
    cappedPool.deposit(scale(20, decimals), {"from": charlie})


def test_uncap(alice, decimals, cappedPool, admin, coin):
    coin.mint_for_testing(alice, scale(100, decimals))
    coin.approve(cappedPool, scale(100, decimals), {"from": alice})
    cappedPool.uncap({"from": admin})
    cappedPool.deposit(scale(30, decimals), {"from": alice})


def test_updated_capped_limit(alice, decimals, cappedPool, admin, coin):
    coin.mint_for_testing(alice, scale(100, decimals))
    coin.approve(cappedPool, scale(100, decimals), {"from": alice})
    cappedPool.updateDepositCap(scale(40, decimals), {"from": admin})
    cappedPool.deposit(scale(30, decimals), {"from": alice})
    with reverts("deposit exceeds deposit cap"):
        cappedPool.deposit(scale(30, decimals), {"from": alice})


def test_cap_after_registering_position(
    alice, decimals, cappedPool, coin, topUpAction, bob, cappedLpToken
):
    coin.mint_for_testing(alice, scale(100, decimals))
    coin.approve(cappedPool, scale(100, decimals), {"from": alice})
    cappedPool.deposit(scale(10, decimals), {"from": alice})
    cappedPool.deposit(scale(10, decimals), {"from": alice})
    with reverts("deposit exceeds deposit cap"):
        cappedPool.deposit(scale(5, decimals), {"from": alice})

    assert cappedLpToken.balanceOf(alice) > scale(15, decimals)
    cappedLpToken.approve(topUpAction, scale(10, decimals), {"from": alice})

    value = scale(5, 9) * topUpAction.getEstimatedGasUsage()
    tx = topUpAction.register(
        encode_account(bob),
        PROTOCOL_1_ADDRESS,
        scale(10, decimals),
        TopUpRecord(
            threshold=scale("5"),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=cappedLpToken,
            singleTopUpAmount=scale(10, decimals),
            totalTopUpAmount=scale(10, decimals),
        ),
        {"from": alice, "value": value},
    )

    assert tx.events["Register"][0]["account"] == encode_account(bob)
    assert tx.events["Register"][0]["protocol"] == PROTOCOL_1_ADDRESS
    assert tx.events["Register"][0]["threshold"] == scale(5)

    with reverts("deposit exceeds deposit cap"):
        cappedPool.deposit(scale(5, decimals), {"from": alice})
