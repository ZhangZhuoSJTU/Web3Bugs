import pytest
from brownie.test.managers.runner import RevertContextManager as reverts
from support.constants import ADMIN_DELAY, AddressProviderKeys
from support.contract_utils import update_topup_handler
from support.types import TopUpRecord
from support.utils import encode_account, scale
from support.convert import format_to_bytes

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


@pytest.fixture
def swapperSetup(
    admin, address_provider, coin, swapperRegistry, mockSwapper, mockErc20Coin, chain
):
    mockErc20Coin.mint_for_testing(mockSwapper, 1_000_000 * 1e18)
    swapperRegistry.registerSwapper(coin, mockErc20Coin, mockSwapper)
    address_provider.initializeAddress(
        AddressProviderKeys.SWAPPER_REGISTRY.value, swapperRegistry, {"from": admin}
    )


def _create_position(on_behalf_of, threshold, coin, payer, topUpAction, pool, lpToken):
    decimals = coin.decimals()
    single_topup_amount = scale(2, decimals)
    total_topup_amount = scale(10, decimals)

    deposit_amount = total_topup_amount * 2
    pool.deposit(deposit_amount, {"from": payer})

    lpToken.approve(topUpAction, total_topup_amount, {"from": payer})
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
    topUpAction.register(
        encode_account(on_behalf_of),
        MOCK_PROTOCOL_NAME,
        total_topup_amount,
        record,
        {"from": payer, "value": gas_deposit},
    )
    return record


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

    record = _create_position(alice, "1.5", coin, alice, topUpAction, pool, lpToken)

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


def test_topup_gas_price_too_high(alice, bob, topUpAction, coin, lpToken, pool):
    record = _create_position(alice, "1.5", coin, alice, topUpAction, pool, lpToken)

    with reverts("too much ETH will be used for gas"):
        topUpAction.execute(
            alice,
            encode_account(alice),
            bob,
            MOCK_PROTOCOL_NAME,
            {"from": alice, "priority_fee": record.priorityFee + scale(1, 9)},
        )


def test_topup_gas_price_boost(chain, alice, bob, topUpAction, coin, lpToken, pool):
    record = _create_position(alice, "1.5", coin, alice, topUpAction, pool, lpToken)

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


@pytest.mark.usefixtures("swapperSetup")
def test_can_execute_with_underlying_not_action_token(
    alice, topUpAction, pool, lpToken, mockErc20Coin, topUpKeeperHelper
):
    _create_position(alice, "1.5", mockErc20Coin, alice, topUpAction, pool, lpToken)
    assert topUpKeeperHelper.canExecute(
        (alice, encode_account(alice), MOCK_PROTOCOL_NAME)
    )


@pytest.mark.usefixtures("swapperSetup")
def test_top_up_with_underlying_not_action_token(
    alice, bob, topUpAction, pool, lpToken, mockErc20Coin
):
    record = _create_position(
        alice, "1.5", mockErc20Coin, alice, topUpAction, pool, lpToken
    )

    tx = topUpAction.execute(
        alice,
        encode_account(alice),
        bob,
        MOCK_PROTOCOL_NAME,
        {"from": alice, "priority_fee": record.priorityFee},
    )

    execute_event = tx.events["TopUp"][0]
    assert execute_event["depositToken"] == lpToken
    assert execute_event["actionToken"] == mockErc20Coin
    assert execute_event["topupAmount"] == record.singleTopUpAmount
    amount_with_fees = record.singleTopUpAmount * (scale(1) + TOPUP_FEE) / scale(1.1)
    assert pytest.approx(execute_event["consumedDepositAmount"]) == amount_with_fees


@pytest.mark.usefixtures("set_bkd_locker_to_mock_token")
def test_topup_fails_with_unsufficient_staked(
    alice, topUpAction, coin, lpToken, pool, controller, execute_with_delay
):
    execute_with_delay(controller, "KeeperRequiredStakedBKD", scale(10))
    record = _create_position(alice, "1.5", coin, alice, topUpAction, pool, lpToken)
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
    alice, topUpAction, coin, lpToken, pool, controller, execute_with_delay, mockToken
):
    execute_with_delay(controller, "KeeperRequiredStakedBKD", scale(10))
    mockToken.mintFor(alice, scale(10), {"from": alice})
    record = _create_position(alice, "1.5", coin, alice, topUpAction, pool, lpToken)
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
