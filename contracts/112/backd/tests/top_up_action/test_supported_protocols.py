import brownie
from brownie.convert.datatypes import HexString

from brownie import ZERO_ADDRESS
from support.constants import ADMIN_DELAY
from support.contract_utils import update_topup_handler
from support.convert import format_to_bytes

protocol = {
    "name": "Compound",
    "handler": "0xE2D06cFf756B6bEE58269B40a67E147ba6D6E538",
}


def test_update_handler(admin, alice, chain, topUpAction):
    assert len(topUpAction.getSupportedProtocols()) == 0
    nameB32 = format_to_bytes(protocol["name"], 32, output_hex=True)

    with brownie.reverts("unauthorized access"):
        topUpAction.prepareTopUpHandler(nameB32, protocol["handler"], {"from": alice})

    assert nameB32 not in topUpAction.getSupportedProtocols()
    tx = topUpAction.prepareTopUpHandler(nameB32, protocol["handler"], {"from": admin})

    assert len(tx.events) == 1
    assert tx.events["ConfigPreparedAddress"]["value"] == protocol["handler"]

    assert nameB32 not in topUpAction.getSupportedProtocols()

    chain.sleep(ADMIN_DELAY)

    tx = topUpAction.executeTopUpHandler(nameB32, {"from": admin})
    assert tx.events["ConfigUpdatedAddress"]["newValue"] == protocol["handler"]
    assert len(tx.events) == 1

    assert nameB32 in topUpAction.getSupportedProtocols()
    assert len(topUpAction.getSupportedProtocols()) == 1

    update_topup_handler(topUpAction, nameB32, ZERO_ADDRESS, chain, admin)
    assert nameB32 not in topUpAction.getSupportedProtocols()
