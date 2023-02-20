from decimal import Decimal
import pytest
from support.constants import ADMIN_DELAY
from support.contract_utils import update_topup_handler
from support.types import TopUpRecord

from support.utils import encode_account, scale

PROTOCOL_1_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"
PROTOCOL_2_ADDRESS = "0x398ec7346dcd622edc5ae82352f02be94c62d119"

pytestmark = pytest.mark.usefixtures("setUpVault", "setUpPool", "addInitialLiquidity")

# vault params
TARGET_ALLOC = 0.9
DEVIATION_BOUND = 0.05


@pytest.fixture
def setUpPool(admin, pool, chain):
    pool.prepareNewMaxWithdrawalFee(0, {"from": admin})
    pool.prepareNewMinWithdrawalFee(0, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    pool.executeNewMaxWithdrawalFee({"from": admin})
    pool.executeNewMinWithdrawalFee({"from": admin})


@pytest.fixture
def setUpVault(admin, vault, mockStrategy):
    vault.setStrategy(mockStrategy, {"from": admin})
    vault.activateStrategy({"from": admin})
    mockStrategy.setVault(vault, {"from": admin})
    vault.setTargetAllocation(10**18 * TARGET_ALLOC)
    vault.setBound(10**18 * DEVIATION_BOUND)


@pytest.fixture
def registerSetUp(address_provider, topUpAction, admin, chain, pool, mockTopUpHandler):
    address_provider.addPool(pool, {"from": admin})
    update_topup_handler(
        topUpAction, PROTOCOL_1_ADDRESS, mockTopUpHandler, chain, admin
    )
    update_topup_handler(
        topUpAction, PROTOCOL_2_ADDRESS, mockTopUpHandler, chain, admin
    )


def test_strategy_allocation(
    alice, pool, vault, lpToken, mockStrategy, initialAmount, coin
):
    assert lpToken.balanceOf(alice) == initialAmount
    assert coin.balanceOf(pool) == 0
    assert pytest.approx(coin.balanceOf(vault)) == (1 - TARGET_ALLOC) * initialAmount
    assert pytest.approx(coin.balanceOf(mockStrategy)) == TARGET_ALLOC * initialAmount


def test_rebalance_allocation_after_idle_withdraw(
    alice, pool, vault, mockStrategy, coin, initialAmount
):
    expected = (1 - TARGET_ALLOC) * initialAmount
    assert pytest.approx(coin.balanceOf(vault), rel=0.001) == expected
    pool.redeem(0.2 * initialAmount, {"from": alice})
    expected = (1 - TARGET_ALLOC) * 0.8 * initialAmount
    assert pytest.approx(coin.balanceOf(vault), rel=0.001) == expected
    expected = TARGET_ALLOC * 0.8 * initialAmount
    assert pytest.approx(coin.balanceOf(mockStrategy), rel=0.001) == expected


def test_no_rebalance(alice, pool, vault, initialAmount, mockStrategy, coin):
    vaultBalance = coin.balanceOf(vault)
    assert pytest.approx(vaultBalance, rel=0.001) == (1 - TARGET_ALLOC) * initialAmount
    pool.redeem(0.05 * initialAmount, {"from": alice})
    # dev: 4.74% deviation within 5% bound; should not rebalance allocation
    assert pytest.approx(
        coin.balanceOf(vault), rel=0.001
    ) == vaultBalance - coin.balanceOf(vault)
    assert (
        pytest.approx(coin.balanceOf(mockStrategy), rel=0.001)
        == TARGET_ALLOC * initialAmount
    )


def test_rebalance_out_of_bounds(alice, pool, vault, initialAmount, mockStrategy, coin):
    redeemAmount = 0.06 * initialAmount
    pool.redeem(redeemAmount, {"from": alice})
    # dev: 5.75% deviation outside 5%; should rebalance allocations
    assert pytest.approx(coin.balanceOf(vault), rel=0.001) == (1 - TARGET_ALLOC) * (
        initialAmount - redeemAmount
    )
    assert pytest.approx(coin.balanceOf(mockStrategy), rel=0.001) == TARGET_ALLOC * (
        initialAmount - redeemAmount
    )


@pytest.mark.skip(reason="Fix this")
def test_rebalance_with_unharvested_profits(
    alice, pool, vault, initialAmount, mockStrategy, coin
):
    profit = 0.01 * initialAmount  # 1% profit
    coin.mint_for_testing(mockStrategy, profit)
    # dev: untaxed profits should be taken into account
    assert (
        pytest.approx(coin.balanceOf(mockStrategy), rel=0.001)
        == (TARGET_ALLOC * initialAmount) + profit
    )
    assert (
        pytest.approx(coin.balanceOf(vault), rel=0.001)
        == (1 - TARGET_ALLOC) * initialAmount
    )
    fee = vault.performanceFee() / 1e18
    assert fee == 0.05
    total = initialAmount + (1 - fee) * profit
    assert vault.getTotalUnderlying.call() == total
    rate = pool.exchangeRate.call() / 1e18
    pool.redeem(0.2 * initialAmount, {"from": alice})

    total = vault.getTotalUnderlying.call()
    assert pytest.approx(coin.balanceOf(vault), rel=0.001) == (1 - TARGET_ALLOC) * total
    assert (
        pytest.approx(coin.balanceOf(mockStrategy), rel=0.001) == TARGET_ALLOC * total
    )


def test_withdraw_all_allocated(admin, vault, initialAmount, coin):
    vault.withdrawAllFromStrategy({"from": admin})
    assert coin.balanceOf(vault) == initialAmount


def test_withdraw_all_allocated_vault_and_strategy(pool, admin, coin, initialAmount):
    pool.withdrawAll({"from": admin})
    assert coin.balanceOf(pool) == initialAmount


def test_rebalance_if_backed_positions_exist(
    admin,
    alice,
    pool,
    topUpAction,
    registerSetUp,
    lpToken,
    initialAmount,
    vault,
    stakerVault,
    mockStrategy,
    coin,
):
    lpToken.approve(topUpAction, 0.5 * initialAmount, {"from": alice})
    topUpAction.register(
        encode_account(alice),
        PROTOCOL_1_ADDRESS,
        Decimal("0.5") * initialAmount,  # LP amount
        TopUpRecord(
            threshold=scale(5),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=lpToken,
            singleTopUpAmount=Decimal("0.25") * initialAmount,
            totalTopUpAmount=Decimal("0.5") * initialAmount,
        ),
        {"from": alice, "value": scale(10, 9) * topUpAction.getEstimatedGasUsage()},
    )

    pool.rebalanceVault()  # must be called (unless deposit/withdrawal occurs) or vault will not rebalance

    assert lpToken.balanceOf(alice) == 0.5 * initialAmount

    assert coin.balanceOf(pool) == 0.5 * initialAmount  # required reserve ratio at 100%
    assert pytest.approx(coin.balanceOf(vault), rel=0.001) == 0.1 * 0.5 * initialAmount
    assert (
        pytest.approx(coin.balanceOf(mockStrategy), rel=0.001)
        == 0.9 * 0.5 * initialAmount
    )
    assert (
        pytest.approx(mockStrategy.balance.call(), rel=0.001)
        == 0.9 * 0.5 * initialAmount
    )
    assert (
        pytest.approx(vault.currentAllocated(), rel=0.001) == 0.9 * 0.5 * initialAmount
    )

    assert (
        pytest.approx(vault.getTotalUnderlying.call({"from": admin}), rel=0.001)
        == 0.5 * initialAmount
    )
    assert pool.exchangeRate() == 1e18

    lpToken.approve(topUpAction, 0.5 * initialAmount, {"from": alice})
    topUpAction.register(
        encode_account(alice),
        PROTOCOL_2_ADDRESS,
        Decimal("0.5") * initialAmount,
        TopUpRecord(
            threshold=scale(5),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=coin,
            depositToken=lpToken,
            singleTopUpAmount=Decimal("0.25") * initialAmount,
            totalTopUpAmount=Decimal("0.5") * initialAmount,
        ),
        {"from": alice, "value": scale(10, 9) * topUpAction.getEstimatedGasUsage()},
    )

    pool.rebalanceVault()

    assert coin.balanceOf(pool) == initialAmount
    assert coin.balanceOf(vault) == 0
    assert coin.balanceOf(mockStrategy) == 0
    assert lpToken.balanceOf(topUpAction) == 0
    assert lpToken.balanceOf(stakerVault) == initialAmount
    assert stakerVault.balanceOf(topUpAction) == initialAmount
