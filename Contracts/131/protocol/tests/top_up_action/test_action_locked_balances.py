import pytest
from support.constants import ADMIN_DELAY
from support.contract_utils import update_topup_handler
from support.types import TopUpRecord
from support.convert import format_to_bytes
from support.utils import encode_account, scale

PROTOCOL_1_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"

MOCK_PROTOCOL_NAME = format_to_bytes("mock", 32)

pytestmark = pytest.mark.usefixtures(
    "registerSetUp",
    "setup_staker_vault_and_minter",
    "curveInitialLiquidity",
    "vault",
    "mintAlice",
    "approveAlice",
    "curveInitialLiquidity",
)


@pytest.fixture
def registerSetUp(topUpAction, admin, chain, pool, mockTopUpHandler, address_provider):
    address_provider.addPool(pool, {"from": admin})
    update_topup_handler(
        topUpAction, MOCK_PROTOCOL_NAME, mockTopUpHandler, chain, admin
    )


@pytest.fixture
def setup_staker_vault_and_minter(
    inflation_manager,
    address_provider,
    admin,
    chain,
    stakerVault,
    lpToken,
    mockKeeperGauge,
    topUpAction,
    pool,
):
    inflation_manager.setKeeperGauge(pool, mockKeeperGauge, {"from": admin})

    inflation_manager.prepareKeeperPoolWeight(pool, 0.5 * 1e18, {"from": admin})
    inflation_manager.prepareLpPoolWeight(lpToken, 0.5 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    inflation_manager.executeKeeperPoolWeight(pool)
    inflation_manager.executeLpPoolWeight(lpToken)
    address_provider.addAction(topUpAction, {"from": admin})


def test_action_locked_balance_updates_on_registration_and_execution(
    stakerVault,
    alice,
    bob,
    pool,
    lpToken,
    topUpAction,
    coin,
    lpGauge,
    chain,
):
    assert lpGauge.poolStakedIntegral() == 0
    assert lpGauge.perUserStakedIntegral(alice) == 0
    assert lpGauge.perUserShare(alice) == 0
    assert lpGauge.perUserStakedIntegral(bob) == 0
    assert lpGauge.perUserShare(bob) == 0

    decimals = coin.decimals()
    single_topup_amount = scale(2, decimals)
    total_topup_amount = scale(10, decimals)
    topup_fee = scale("0.02")
    topUpAction.setActionFee(topup_fee)

    deposit_amount = total_topup_amount * 2
    pool.deposit(deposit_amount, {"from": alice})
    assert lpToken.balanceOf(alice) == deposit_amount

    lpToken.approve(topUpAction, total_topup_amount, {"from": alice})

    topUpAction.register(
        encode_account(alice),
        MOCK_PROTOCOL_NAME,
        total_topup_amount,
        TopUpRecord(
            threshold=scale("1.5"),
            depositToken=lpToken,
            actionToken=coin,
            singleTopUpAmount=single_topup_amount,
            totalTopUpAmount=total_topup_amount,
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
        ),
        {"from": alice, "value": 5 * scale(5, 9) * topUpAction.getEstimatedGasUsage()},
    )

    assert stakerVault.actionLockedBalances(alice) == total_topup_amount
    chain.sleep(1)

    tx = topUpAction.execute(
        alice,
        encode_account(alice),
        bob,
        MOCK_PROTOCOL_NAME,
        {"from": alice, "priority_fee": scale(1, 9)},
    )
    execute_event = tx.events["TopUp"][0]
    assert execute_event["topupAmount"] == single_topup_amount
    amount_with_fees = single_topup_amount * (scale(1) + topup_fee) / scale(1)
    assert execute_event["consumedDepositAmount"] == amount_with_fees

    assert (
        stakerVault.actionLockedBalances(alice) == total_topup_amount - amount_with_fees
    )


def test_action_locked_balance_updates_on_registration_and_reset(
    stakerVault,
    alice,
    bob,
    pool,
    lpToken,
    topUpAction,
    coin,
    lpGauge,
):
    assert lpGauge.poolStakedIntegral() == 0
    assert lpGauge.perUserStakedIntegral(alice) == 0
    assert lpGauge.perUserShare(alice) == 0
    assert lpGauge.perUserStakedIntegral(bob) == 0
    assert lpGauge.perUserShare(bob) == 0

    decimals = coin.decimals()
    single_topup_amount = scale(2, decimals)
    total_topup_amount = scale(10, decimals)
    topup_fee = scale("0.02")
    topUpAction.setActionFee(topup_fee)

    deposit_amount = total_topup_amount * 2
    pool.deposit(deposit_amount, {"from": alice})
    assert lpToken.balanceOf(alice) == deposit_amount

    lpToken.approve(topUpAction, total_topup_amount, {"from": alice})

    topUpAction.register(
        encode_account(bob),
        MOCK_PROTOCOL_NAME,
        total_topup_amount,
        TopUpRecord(
            threshold=scale("1.5"),
            depositToken=lpToken,
            actionToken=coin,
            singleTopUpAmount=single_topup_amount,
            totalTopUpAmount=total_topup_amount,
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
        ),
        {"from": alice, "value": 5 * scale(5, 9) * topUpAction.getEstimatedGasUsage()},
    )

    assert stakerVault.actionLockedBalances(alice) == total_topup_amount

    topUpAction.resetPosition(
        encode_account(bob), MOCK_PROTOCOL_NAME, False, {"from": alice}
    )
    assert stakerVault.actionLockedBalances(alice) == 0
