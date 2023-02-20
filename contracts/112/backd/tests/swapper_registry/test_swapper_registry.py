import pytest
import brownie

from brownie import ZERO_ADDRESS

MOCK_COIN_A = "0x328DB824B016326A401d083B33D092293333A830"
MOCK_COIN_B = "0x823BA424B016326A401d083B3CC017892233A271"
MOCK_COIN_C = "0x1C1004B016326A4021d083B3C4C017982233B53D"
MOCK_COIN_D = "0x2DB02eB01e326A8681d02eB3Cee017d03C3327EE"

MOCK_SWAPPER = "0x47C11424B010086A401d063B3AA014892AB3C999"


def test_add_swapper(admin, swapperRegistry):
    tx = swapperRegistry.registerSwapper(
        MOCK_COIN_A, MOCK_COIN_B, MOCK_SWAPPER, {"from": admin}
    )
    assert tx.return_value
    assert tx.events["NewSwappablePair"]["fromToken"] == MOCK_COIN_A
    assert tx.events["NewSwappablePair"]["toToken"] == MOCK_COIN_B
    assert tx.events["NewSwapper"]["fromToken"] == MOCK_COIN_A
    assert tx.events["NewSwapper"]["toToken"] == MOCK_COIN_B
    assert tx.events["NewSwapper"]["newSwapper"] == MOCK_SWAPPER


def test_add_existing_swapper(admin, swapperRegistry):
    tx = swapperRegistry.registerSwapper(
        MOCK_COIN_A, MOCK_COIN_B, MOCK_SWAPPER, {"from": admin}
    )
    assert tx.return_value
    tx = swapperRegistry.registerSwapper(
        MOCK_COIN_A, MOCK_COIN_B, MOCK_SWAPPER, {"from": admin}
    )
    assert tx.return_value == False


def test_get_swapper(admin, swapperRegistry):
    assert swapperRegistry.registerSwapper(
        MOCK_COIN_A, MOCK_COIN_B, MOCK_SWAPPER, {"from": admin}
    )
    assert swapperRegistry.getSwapper(MOCK_COIN_A, MOCK_COIN_B) == MOCK_SWAPPER


def test_swapper_exists(admin, swapperRegistry):
    assert swapperRegistry.swapperExists(MOCK_COIN_A, MOCK_COIN_B) == False
    assert swapperRegistry.registerSwapper(
        MOCK_COIN_A, MOCK_COIN_B, MOCK_SWAPPER, {"from": admin}
    )
    assert swapperRegistry.swapperExists(MOCK_COIN_A, MOCK_COIN_B)


def test_replace_swapper(admin, swapperRegistry):
    assert swapperRegistry.registerSwapper(
        MOCK_COIN_A, MOCK_COIN_B, MOCK_SWAPPER, {"from": admin}
    )
    swapper = "0x00CAA424B01B786A401d063B3AA014892AB3D111"
    tx = swapperRegistry.registerSwapper(
        MOCK_COIN_A, MOCK_COIN_B, swapper, {"from": admin}
    )
    assert tx.return_value
    assert tx.events["SwapperRemoved"]["fromToken"] == MOCK_COIN_A
    assert tx.events["SwapperRemoved"]["toToken"] == MOCK_COIN_B
    assert tx.events["SwapperRemoved"]["oldSwapper"] == MOCK_SWAPPER
    assert tx.events["NewSwapper"]["fromToken"] == MOCK_COIN_A
    assert tx.events["NewSwapper"]["toToken"] == MOCK_COIN_B
    assert tx.events["NewSwapper"]["newSwapper"] == swapper
    assert swapperRegistry.getSwapper(MOCK_COIN_A, MOCK_COIN_B) == swapper


def test_swapper_does_not_exist(swapperRegistry):
    assert swapperRegistry.getSwapper(MOCK_COIN_A, MOCK_COIN_B) == ZERO_ADDRESS


def test_all_swappable_tokens(swapperRegistry, admin):
    # Add two swappable pairs
    tx = swapperRegistry.registerSwapper(
        MOCK_COIN_A, MOCK_COIN_B, MOCK_SWAPPER, {"from": admin}
    )
    assert tx.return_value
    tx = swapperRegistry.registerSwapper(
        MOCK_COIN_A, MOCK_COIN_C, MOCK_SWAPPER, {"from": admin}
    )
    assert tx.return_value
    # Get all tokens swappable for MOCK_COIN_A
    assert swapperRegistry.getAllSwappableTokens(MOCK_COIN_A) == [
        MOCK_COIN_B,
        MOCK_COIN_C,
    ]


def test_one_way_swappable(swapperRegistry, admin):
    # Add two swappable pairs
    tx = swapperRegistry.registerSwapper(
        MOCK_COIN_A, MOCK_COIN_B, MOCK_SWAPPER, {"from": admin}
    )
    assert tx.return_value
    tx = swapperRegistry.registerSwapper(
        MOCK_COIN_A, MOCK_COIN_C, MOCK_SWAPPER, {"from": admin}
    )
    assert tx.return_value

    # Should not be included
    tx = swapperRegistry.registerSwapper(
        MOCK_COIN_D, MOCK_COIN_A, MOCK_SWAPPER, {"from": admin}
    )
    assert tx.return_value

    # Get all tokens swappable for MOCK_COIN_A
    assert swapperRegistry.getAllSwappableTokens(MOCK_COIN_A) == [
        MOCK_COIN_B,
        MOCK_COIN_C,
    ]
