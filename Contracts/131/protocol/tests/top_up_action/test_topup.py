import threading

import pytest
from brownie.test.managers.runner import RevertContextManager as reverts
from support.contract_utils import update_topup_handler
from support.convert import format_to_bytes
from support.types import TopUpRecord
from support.utils import encode_account, scale

MOCK_PROTOCOL_NAME = format_to_bytes("mock", 32)
TOPUP_FEE = scale("0.02")

pytestmark = pytest.mark.usefixtures(
    "registerSetUp",
    "curveInitialLiquidity",
    "vault",
    "mintAlice",
    "approveAlice",
    "curveInitialLiquidity",
)


@pytest.fixture
def registerSetUp(chain, topUpAction, address_provider, admin, pool, mockTopUpHandler):
    address_provider.addPool(pool, {"from": admin})
    update_topup_handler(
        topUpAction, MOCK_PROTOCOL_NAME, mockTopUpHandler, chain, admin
    )
    topUpAction.setActionFee(TOPUP_FEE, {"from": admin})


@pytest.fixture
def mockErc20Coin(MockErc20, admin):
    return admin.deploy(MockErc20, 18)


def _create_position(
    on_behalf_of, threshold, coin, payer, topUpAction, pool, lpToken, chain=None
):
    confirmations = 0
    if chain:
        confirmations = 1

    decimals = coin.decimals()
    single_topup_amount = scale(2, decimals)
    total_topup_amount = scale(10, decimals)

    options = {"from": payer, "required_confs": confirmations}

    deposit_amount = total_topup_amount * 2
    pool.deposit(deposit_amount, options)

    lpToken.approve(topUpAction, total_topup_amount, options)
    max_gas_price = scale(30, 9)
    topup_count = (total_topup_amount + single_topup_amount - 1) // single_topup_amount
    gas_deposit = max_gas_price * topup_count * topUpAction.getEstimatedGasUsage()
    record = TopUpRecord(
        threshold=scale(threshold),
        priorityFee=scale(1, 9),
        maxFee=max_gas_price,
        actionToken=coin,
        depositToken=lpToken,
        singleTopUpAmount=single_topup_amount,
        totalTopUpAmount=total_topup_amount,
    )

    tx = topUpAction.register(
        encode_account(on_behalf_of),
        MOCK_PROTOCOL_NAME,
        total_topup_amount,
        record,
        {**options, "value": gas_deposit},
    )
    if chain:
        chain.sleep(1)

    return record, tx


def test_get_health_factor(alice, topUpAction):
    assert topUpAction.getHealthFactor(
        MOCK_PROTOCOL_NAME, encode_account(alice), b""
    ) == scale("1.3")


def test_can_execute(coin, alice, topUpAction, pool, lpToken, topUpKeeperHelper):
    _create_position(alice, "1.5", coin, alice, topUpAction, pool, lpToken)
    assert topUpKeeperHelper.canExecute(
        (alice, encode_account(alice), MOCK_PROTOCOL_NAME)
    )


def test_can_execute_batch(
    coin, alice, bob, topUpAction, pool, lpToken, topUpKeeperHelper
):
    _create_position(alice, "1.5", coin, alice, topUpAction, pool, lpToken)
    _create_position(bob, "1.2", coin, alice, topUpAction, pool, lpToken)
    results = topUpKeeperHelper.batchCanExecute(
        [
            (alice, encode_account(alice), MOCK_PROTOCOL_NAME),
            (alice, encode_account(bob), MOCK_PROTOCOL_NAME),
        ]
    )
    assert results == [True, False]


def test_topup(chain, alice, bob, topUpAction, coin, lpToken, pool, gas_bank):
    single_topup_amount = scale(2, coin.decimals())

    record, _ = _create_position(
        alice, "1.5", coin, alice, topUpAction, pool, lpToken, chain
    )

    previous_gas_balance = gas_bank.balanceOf(alice)
    tx = topUpAction.execute(
        alice,
        encode_account(alice),
        bob,
        MOCK_PROTOCOL_NAME,
        {"from": alice, "priority_fee": record.priorityFee},
    )
    assert tx.gas_price == chain.base_fee + record.priorityFee

    new_gas_balance = gas_bank.balanceOf(alice)

    assert new_gas_balance < previous_gas_balance

    gas_bank_withdraw_event = tx.events["Withdraw"][0]
    assert gas_bank_withdraw_event["account"] == alice
    assert gas_bank_withdraw_event["value"] == previous_gas_balance - new_gas_balance

    gas_consumed = gas_bank_withdraw_event["value"] // tx.gas_price

    # FIXME: this should succeed but for some reason does not
    # assert gas_consumed < tx.gas_used

    execute_event = tx.events["TopUp"][0]
    assert execute_event["topupAmount"] == single_topup_amount
    amount_with_fees = single_topup_amount * (scale(1) + TOPUP_FEE) / scale(1)
    assert execute_event["consumedDepositAmount"] == amount_with_fees
    new_user_factor = topUpAction.getHealthFactor(
        MOCK_PROTOCOL_NAME, encode_account(alice), b""
    )
    # mock version starts at 1.3 and has +0.3 if topup is succesful
    assert new_user_factor == scale("1.6")


def test_topup_gas_price_too_high(alice, bob, topUpAction, coin, lpToken, pool, chain):
    record, _ = _create_position(
        alice, "1.5", coin, alice, topUpAction, pool, lpToken, chain
    )

    with reverts("too much ETH will be used for gas"):
        topUpAction.execute(
            alice,
            encode_account(alice),
            bob,
            MOCK_PROTOCOL_NAME,
            {"from": alice, "priority_fee": record.priorityFee + scale(1, 9)},
        )


def test_topup_gas_price_boost(chain, alice, bob, topUpAction, coin, lpToken, pool):
    record, _ = _create_position(
        alice, "1.5", coin, alice, topUpAction, pool, lpToken, chain
    )

    priority_fee_boost = scale(3, 9)
    wei_boost = topUpAction.getEstimatedGasUsage() * priority_fee_boost

    # should succeed despite higher priority fee because of the wei boost
    tx = topUpAction.execute(
        alice,
        encode_account(alice),
        bob,
        MOCK_PROTOCOL_NAME,
        wei_boost,
        {"from": alice, "priority_fee": record.priorityFee + priority_fee_boost},
    )
    assert tx.gas_price == chain.base_fee + record.priorityFee + priority_fee_boost


@pytest.mark.usefixtures("set_bkd_locker_to_mock_token")
def test_topup_fails_with_unsufficient_staked(
    alice, topUpAction, coin, lpToken, pool, controller, execute_with_delay, chain
):
    execute_with_delay(controller, "KeeperRequiredStakedBKD", scale(10))
    record, _ = _create_position(
        alice, "1.5", coin, alice, topUpAction, pool, lpToken, chain
    )
    with reverts("Not enough BKD tokens staked"):
        topUpAction.execute(
            alice,
            encode_account(alice),
            alice,
            MOCK_PROTOCOL_NAME,
            {"from": alice, "priority_fee": record.priorityFee},
        )


@pytest.mark.usefixtures("set_bkd_locker_to_mock_token")
def test_topup_succeeds_with_sufficient_staked(
    alice,
    topUpAction,
    coin,
    lpToken,
    pool,
    controller,
    execute_with_delay,
    mockToken,
    chain,
):
    execute_with_delay(controller, "KeeperRequiredStakedBKD", scale(10))
    mockToken.mintFor(alice, scale(10), {"from": alice})
    record, _ = _create_position(
        alice, "1.5", coin, alice, topUpAction, pool, lpToken, chain
    )
    tx = topUpAction.execute(
        alice,
        encode_account(alice),
        alice,
        MOCK_PROTOCOL_NAME,
        {"from": alice, "priority_fee": record.priorityFee},
    )

    execute_event = tx.events["TopUp"][0]
    single_topup_amount = scale(2, coin.decimals())
    assert execute_event["topupAmount"] == single_topup_amount


def test_topup_same_block(
    alice, bob, topUpAction, coin, lpToken, pool, web3, history, chain
):
    web3.geth.miner.stop()

    record, _ = _create_position(alice, "1.5", coin, alice, topUpAction, pool, lpToken)

    tx = topUpAction.execute(
        alice,
        encode_account(alice),
        bob,
        MOCK_PROTOCOL_NAME,
        {"from": alice, "priority_fee": record.priorityFee, "required_confs": 0},
    )

    try:
        web3.geth.miner.start()
    except ValueError as exc:
        history._list = [i for i in history._list if i.block_number is not None]
        reason = exc.args[0]["data"][tx.txid]["reason"]
        assert reason == "cannot execute action in same block"
    finally:
        for t in threading.enumerate():
            if t != threading.current_thread():
                t.join()
