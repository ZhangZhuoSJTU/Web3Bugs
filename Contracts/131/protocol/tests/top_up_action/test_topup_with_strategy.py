import pytest

from brownie import ZERO_ADDRESS
from support.mainnet_contracts import TokenAddresses, VendorAddresses
from support.types import TopUpRecord
from fixtures.coins import mint_coin_for
from support.utils import encode_account, scale
from support.convert import format_to_bytes


AAVE_PROTOCOL = format_to_bytes("Aave", 32)
CONVEX_PID = 40
CURVE_POOL = "0x5a6A4D54456819380173272A5E8E9B9904BdF41B"
CURVE_HOP_POOL = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7"
CURVE_INDEX_USDC = 1
CURVE_INDEX_DAI = 0
DEFAULT_BALANCE = 500_000
TARGET_ALLOC = 1


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def strategy(BkdTriHopCvx, BkdEthCvx, vault, admin, coin, alice, bob, address_provider):
    if coin == ZERO_ADDRESS:
        return admin.deploy(
            BkdEthCvx,
            bob,
            alice,
            25,
            VendorAddresses.CURVE_STETH_ETH_POOL,
            0,
            address_provider
        )
    if coin.address == TokenAddresses.DAI:
        return admin.deploy(
            BkdTriHopCvx,
            vault,
            alice,
            CONVEX_PID,
            CURVE_POOL,
            1,
            CURVE_HOP_POOL,
            CURVE_INDEX_DAI,
            address_provider
        )
    if coin.address == TokenAddresses.USDC:
        return admin.deploy(
            BkdTriHopCvx,
            vault,
            alice,
            CONVEX_PID,
            CURVE_POOL,
            1,
            CURVE_HOP_POOL,
            CURVE_INDEX_USDC,
            address_provider
        )


@pytest.fixture
def setUp(admin, vault, pool, strategy, coin, alice, decimals):
    vault.setStrategy(strategy, {"from": admin})
    vault.activateStrategy({"from": admin})
    vault.setTargetAllocation(10**18 * TARGET_ALLOC)

    amount = DEFAULT_BALANCE * 10**decimals
    mint_coin_for(alice, coin, amount)
    coin.approve(pool, 2**256 - 1, {"from": alice})
    pool.deposit(amount, {"from": alice})


@pytest.mark.usefixtures("setUp")
@pytest.mark.mainnetFork
def test_set_up(vault, strategy, pool, decimals, alice, lpToken):
    assert vault.pool() == pool
    assert pool.getVault() == vault
    assert vault.getStrategy() == strategy
    assert lpToken.balanceOf(alice) == DEFAULT_BALANCE * 10**decimals


@pytest.mark.usefixtures("setUp")
@pytest.mark.mainnetFork
def test_top_up_with_strategy_withdrawal(
    vault, topUpAction, coin, interface, bob, strategy, pool, decimals, alice, lpToken, admin
):
    strategy.setHopImbalanceToleranceOut(scale("0.1"), {"from": admin})
    deposit_amount = DEFAULT_BALANCE * 10**decimals
    single_topup_amount = 200_000 * 10**decimals
    total_topup_amount = 200_000 * 10**decimals

    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(vault) == 0
    assert coin.balanceOf(strategy) == 0
    assert vault.currentAllocated() == deposit_amount
    assert strategy.balance() > 0

    lpToken.approve(topUpAction, total_topup_amount, {"from": alice})

    # Depositing on Aave
    coin.approve(
        VendorAddresses.AAVE_LENDING_POOL, scale(100_000, decimals), {"from": alice}
    )
    aaveLendingPool = interface.ILendingPool(VendorAddresses.AAVE_LENDING_POOL)
    aaveLendingPool.deposit(coin, scale(1000, decimals), alice, 0, {"from": alice})

    # Borrowing on Aave
    availableBorrowsETH = aaveLendingPool.getUserAccountData(alice, {"from": alice})[2]
    aaveLendingPool.borrow(
        TokenAddresses.WETH, availableBorrowsETH, 2, 0, alice, {"from": alice}
    )

    # Registering topup
    max_fee = scale(50, 9)
    eth_required_for_gas = 5 * max_fee * topUpAction.getEstimatedGasUsage()
    topup_record = TopUpRecord(
        threshold=scale(2, decimals),
        priorityFee=scale(2, 9),
        maxFee=max_fee,
        actionToken=coin,
        depositToken=lpToken,
        singleTopUpAmount=single_topup_amount,
        totalTopUpAmount=total_topup_amount,
    )

    topUpAction.register(
        encode_account(alice),
        AAVE_PROTOCOL,
        total_topup_amount,
        topup_record,
        {"from": alice, "value": eth_required_for_gas},
    )

    aTokenAddress = aaveLendingPool.getReserveData(coin)[7]
    aToken = interface.ERC20(aTokenAddress)
    startingBalance = aToken.balanceOf(alice)

    assert vault.currentAllocated() == scale(500_000, decimals)

    # Executing Topup
    tx = topUpAction.execute(
        alice, encode_account(alice), bob, AAVE_PROTOCOL, {"from": alice}
    )

    assert tx.events["TopUp"]["topupAmount"] == single_topup_amount

    # Checking result
    toppedUp = aToken.balanceOf(alice) - startingBalance
    assert toppedUp >= scale(199_990, decimals)
    assert toppedUp < scale(200_000.001, decimals)
    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(vault) == 0
    assert coin.balanceOf(strategy) == 0

    assert vault.currentAllocated() == deposit_amount - single_topup_amount
