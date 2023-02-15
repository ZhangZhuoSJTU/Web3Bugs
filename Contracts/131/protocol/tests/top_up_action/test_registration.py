import pytest
from brownie.test.managers.runner import RevertContextManager as reverts
from eth_abi.abi import encode_abi
from support.contract_utils import update_topup_handler
from support.types import TopUpRecord
from support.utils import encode_account, scale

PROTOCOL_1_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"

pytestmark = pytest.mark.usefixtures("registerSetUp")


@pytest.fixture
def registerSetUp(address_provider, topUpAction, admin, chain, pool, mockTopUpHandler):
    address_provider.addPool(pool, {"from": admin})
    update_topup_handler(
        topUpAction, PROTOCOL_1_ADDRESS, mockTopUpHandler, chain, admin
    )


@pytest.fixture
def mockErc20Coin(MockErc20, admin):
    return admin.deploy(MockErc20, 18)


def test_register_fail_with_low_balance(alice, bob, topUpAction, coin, lpToken):
    with reverts("ERC20: insufficient allowance"):
        topUpAction.register(
            encode_account(bob),
            PROTOCOL_1_ADDRESS,
            scale(5),
            TopUpRecord(
                threshold=scale("1.2"),
                priorityFee=scale(1, 9),
                maxFee=scale(5, 9),
                actionToken=coin,
                depositToken=lpToken,
                singleTopUpAmount=scale(1),
                totalTopUpAmount=scale(1),
            ),
            {"from": alice, "value": scale(5, 9) * topUpAction.getEstimatedGasUsage()},
        )


def test_register_fail_with_missing_gas_cost(alice, bob, topUpAction, coin, lpToken):
    with reverts("value too low to cover gas"):
        # max gas price is 5 so we need 5 * topUpAction.getEstimatedGasUsage()
        topUpAction.register(
            encode_account(bob),
            PROTOCOL_1_ADDRESS,
            scale(5),
            TopUpRecord(
                threshold=scale("1.2"),
                priorityFee=scale(1, 9),
                maxFee=scale(5, 9),
                actionToken=coin,
                depositToken=lpToken,
                singleTopUpAmount=scale(1),
                totalTopUpAmount=scale(1),
            ),
            {"from": alice, "value": scale(1, 9) * topUpAction.getEstimatedGasUsage()},
        )


def test_register(alice, bob, lpToken, topUpAction, topUpKeeperHelper, coin, gas_bank):
    lpToken.mint_for_testing(alice, 5e18, {"from": alice})
    assert lpToken.balanceOf(alice) == 5e18
    lpToken.approve(topUpAction, 5e18, {"from": alice})
    eth_required_for_gas = 3 * scale(2, 9) * topUpAction.getEstimatedGasUsage()
    topup_record = TopUpRecord(
        threshold=scale(5),
        priorityFee=scale(1, 9),
        maxFee=scale(2, 9),
        actionToken=coin,
        depositToken=lpToken,
        singleTopUpAmount=scale(1),
        totalTopUpAmount=scale("2.5"),
    )
    deposit_amount = scale("2.5")
    tx = topUpAction.register(
        encode_account(bob),  # account
        PROTOCOL_1_ADDRESS,  # protocol
        deposit_amount,
        topup_record,
        {"from": alice, "value": eth_required_for_gas},
    )
    assert tx.events["Register"][0]["account"] == encode_account(bob)
    assert tx.events["Register"][0]["protocol"] == PROTOCOL_1_ADDRESS
    assert tx.events["Register"][0]["threshold"] == scale(5)
    assert tx.events["Register"][0]["payer"] == alice
    assert tx.events["Register"][0]["depositToken"] == lpToken
    assert tx.events["Register"][0]["depositAmount"] == int(2.5e18)
    assert tx.events["Register"][0]["actionToken"] == coin
    assert tx.events["Register"][0]["singleTopUpAmount"] == 1e18
    assert tx.events["Register"][0]["totalTopUpAmount"] == int(2.5e18)
    assert tx.events["Register"][0]["maxGasPrice"] == scale(2, 9)

    position = topUpAction.getPosition(alice, encode_account(bob), PROTOCOL_1_ADDRESS)
    assert position[0] == topup_record.threshold
    assert position[1] == topup_record.priorityFee
    assert position[2] == topup_record.maxFee
    assert position[3] == tx.timestamp
    assert position[4] == coin
    assert position[5] == lpToken
    assert position[6] == topup_record.singleTopUpAmount
    assert position[7] == topup_record.totalTopUpAmount
    assert position[8] == deposit_amount
    assert position[9] == topup_record.extra

    user_positions = topUpKeeperHelper.listPositions(alice)
    assert len(user_positions) == 1
    position_with_meta = user_positions[0]
    assert position_with_meta[0] == encode_account(bob)
    assert position_with_meta[1] == PROTOCOL_1_ADDRESS
    assert position_with_meta[2][0] == scale(5)

    assert topUpAction.getEthRequiredForGas(alice) == eth_required_for_gas

    assert gas_bank.balanceOf(alice) == eth_required_for_gas


def test_fail_register_existing_position(
    alice, bob, lpToken, stakerVault, topUpAction, coin
):
    lpToken.mint_for_testing(alice, 1e18, {"from": alice})
    assert lpToken.balanceOf(alice) == 1e18
    lpToken.approve(topUpAction, 1e18, {"from": alice})

    topUpAction.register(
        encode_account(bob),
        PROTOCOL_1_ADDRESS,
        scale(5),
        TopUpRecord(
            threshold=scale(5),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=lpToken,
            singleTopUpAmount=scale(1),
            totalTopUpAmount=scale(1),
        ),
        {"from": alice, "value": scale(5, 9) * topUpAction.getEstimatedGasUsage()},
    )
    assert stakerVault.balanceOf(topUpAction) == 1e18
    assert stakerVault.balanceOf(alice) == 0
    assert stakerVault.balanceOf(bob) == 0

    with reverts("position already exists"):
        topUpAction.register(
            encode_account(bob),
            PROTOCOL_1_ADDRESS,
            scale(5),
            TopUpRecord(
                threshold=scale(5),
                priorityFee=scale(1, 9),
                maxFee=scale(5, 9),
                actionToken=coin,
                depositToken=lpToken,
                singleTopUpAmount=scale(1),
                totalTopUpAmount=scale(1),
            ),
            {"from": alice, "value": scale(5, 9) * topUpAction.getEstimatedGasUsage()},
        )


def test_fail_multiple_reset(alice, bob, lpToken, topUpAction, coin):
    lpToken.mint_for_testing(alice, 1e18, {"from": alice})
    assert lpToken.balanceOf(alice) == 1e18
    lpToken.approve(topUpAction, 1e18, {"from": alice})
    topUpAction.register(
        encode_account(bob),
        PROTOCOL_1_ADDRESS,
        scale(5),
        TopUpRecord(
            threshold=scale(5),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=lpToken,
            singleTopUpAmount=scale(1),
            totalTopUpAmount=scale(1),
        ),
        {"from": alice, "value": scale(5, 9) * topUpAction.getEstimatedGasUsage()},
    )
    topUpAction.resetPosition(
        encode_account(bob), PROTOCOL_1_ADDRESS, False, {"from": alice}
    )
    with reverts("no position exists"):
        topUpAction.resetPosition(
            encode_account(bob), PROTOCOL_1_ADDRESS, False, {"from": alice}
        )


def test_unstake_on_reset_false(alice, bob, lpToken, topUpAction, coin):
    lpToken.mint_for_testing(alice, 1e18, {"from": alice})
    lpToken.approve(topUpAction, 1e18, {"from": alice})
    topUpAction.register(
        encode_account(bob),
        PROTOCOL_1_ADDRESS,
        scale(5),
        TopUpRecord(
            threshold=scale(5),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=lpToken,
            singleTopUpAmount=scale(1),
            totalTopUpAmount=scale(1),
        ),
        {"from": alice, "value": scale(5, 9) * topUpAction.getEstimatedGasUsage()},
    )
    topUpAction.resetPosition(
        encode_account(bob), PROTOCOL_1_ADDRESS, False, {"from": alice}
    )
    assert lpToken.balanceOf(alice) == 0


def test_unstake_on_reset_true(alice, bob, lpToken, topUpAction, coin):
    lpToken.mint_for_testing(alice, 3e18, {"from": alice})
    lpToken.approve(topUpAction, 3e18, {"from": alice})
    topUpAction.register(
        encode_account(bob),
        PROTOCOL_1_ADDRESS,
        scale(5),
        TopUpRecord(
            threshold=scale(5),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=lpToken,
            singleTopUpAmount=scale(1),
            totalTopUpAmount=scale(1),
        ),
        {"from": alice, "value": scale(5, 9) * topUpAction.getEstimatedGasUsage()},
    )
    assert lpToken.balanceOf(alice) == 2e18
    topUpAction.resetPosition(
        encode_account(bob), PROTOCOL_1_ADDRESS, True, {"from": alice}
    )
    assert lpToken.balanceOf(alice) == 3e18
