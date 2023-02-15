from eth_abi import encode_abi
import pytest
from brownie import interface
from fixtures.coins import mint_coin_for
from support.types import TopUpRecord
from support.convert import format_to_bytes
from support.utils import encode_account, scale
from support.mainnet_contracts import VendorAddresses, TokenAddresses

AAVE_PROTOCOL = format_to_bytes("Aave", 32)
COMPOUND_PROTOCOL = format_to_bytes("Compound", 32)

TOTAL_TOPUP_AMOUNT = scale(10, 18)
SINGLE_TOPUP_AMOUNT = scale(2, 18)


@pytest.fixture(autouse=True)
def give_money_to_charlie(dai, charlie):
    mint_coin_for(charlie, dai, scale(100_000, 18))


def create_aave_position(
    user, decimals, lpToken, topUpAction, dai, pool, executable=True
):
    # Depositing into pool
    lpToken.approve(topUpAction, TOTAL_TOPUP_AMOUNT, {"from": user})
    dai.approve(pool, scale(100, decimals), {"from": user})
    pool.deposit(scale(100, decimals), 0, {"from": user})

    # Depositing on Aave
    dai.approve(
        VendorAddresses.AAVE_LENDING_POOL, scale(100000, decimals), {"from": user}
    )
    aaveLendingPool = interface.ILendingPool(VendorAddresses.AAVE_LENDING_POOL)
    aaveLendingPool.deposit(dai, scale(1000, decimals), user, 0, {"from": user})

    # Borrowing on Aave
    availableBorrowsETH = aaveLendingPool.getUserAccountData(user, {"from": user})[2]
    aaveLendingPool.borrow(
        TokenAddresses.WETH, availableBorrowsETH, 2, 0, user, {"from": user}
    )

    # Registering Topup
    topUpAction.register(
        encode_account(user),
        AAVE_PROTOCOL,
        TOTAL_TOPUP_AMOUNT,
        TopUpRecord(
            threshold=scale(2, decimals) if executable else scale("1.0001", decimals),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=dai,
            depositToken=lpToken,
            singleTopUpAmount=SINGLE_TOPUP_AMOUNT,
            totalTopUpAmount=TOTAL_TOPUP_AMOUNT,
        ),
        {"from": user, "value": scale(25, 9) * topUpAction.getEstimatedGasUsage()},
    )


def create_compound_position(
    user, decimals, lpToken, topUpAction, dai, pool, executable=True
):
    # Depositing into pool
    lpToken.approve(topUpAction, TOTAL_TOPUP_AMOUNT, {"from": user})
    dai.approve(pool, scale(100, decimals), {"from": user})
    pool.deposit(scale(100, decimals), 0, {"from": user})

    # Depositing on Compound
    cDai = interface.CToken(TokenAddresses.C_DAI)
    dai.approve(cDai, scale(100000, decimals), {"from": user})
    cDai.mint(scale(10000, decimals), {"from": user})
    assert cDai.balanceOf(user) > 0
    comptroller = interface.Comptroller(VendorAddresses.COMPOUND_COMPTROLLER)
    tx = comptroller.enterMarkets([TokenAddresses.C_DAI], {"from": user})

    # Borrowing on Compound
    cEth = interface.CEthToken(TokenAddresses.C_ETH)
    balanceBefore = user.balance()
    tx = cEth.borrow(scale(1, decimals), {"from": user})
    wei_used_for_dai = tx.gas_used * tx.gas_price
    tx = cEth.borrowBalanceCurrent(user, {"from": user})
    wei_used_for_dai += tx.gas_used * tx.gas_price
    assert user.balance() - balanceBefore >= scale(1, decimals) - wei_used_for_dai
    assert user.balance() - balanceBefore < scale(2, decimals) - wei_used_for_dai

    # Registering Topup
    topUpAction.register(
        encode_account(user),
        COMPOUND_PROTOCOL,
        TOTAL_TOPUP_AMOUNT,
        TopUpRecord(
            threshold=scale(10, decimals) if executable else scale("1.0001", decimals),
            priorityFee=scale(1, 9),
            maxFee=scale(5, 9),
            actionToken=dai,
            depositToken=lpToken,
            singleTopUpAmount=SINGLE_TOPUP_AMOUNT,
            totalTopUpAmount=TOTAL_TOPUP_AMOUNT,
        ),
        {"from": user, "value": scale(25, 9) * topUpAction.getEstimatedGasUsage()},
    )


@pytest.mark.mainnetFork
def test_returns_nothing_for_no_positions(topUpKeeperHelper):
    executable_positions = topUpKeeperHelper.getExecutableTopups(0, 10)[0]
    assert len(executable_positions) == 0


@pytest.mark.mainnetFork
def test_returns_executable_aave_position(
    topUpKeeperHelper, decimals, lpToken, topUpAction, alice, dai, pool
):
    create_aave_position(alice, decimals, lpToken, topUpAction, dai, pool)

    response = topUpKeeperHelper.getExecutableTopups(0, 10)
    executable_positions = response[0]
    assert len(executable_positions) == 1
    assert executable_positions[0][0] == alice
    assert executable_positions[0][1] == encode_account(alice)
    assert executable_positions[0][3][0] == scale(2, decimals)
    assert executable_positions[0][3][1] == scale(1, 9)
    assert executable_positions[0][3][2] == scale(5, 9)
    assert executable_positions[0][3][3] == dai
    assert executable_positions[0][3][4] == lpToken
    assert executable_positions[0][3][5] == SINGLE_TOPUP_AMOUNT
    assert executable_positions[0][3][6] == TOTAL_TOPUP_AMOUNT
    assert executable_positions[0][3][7] == TOTAL_TOPUP_AMOUNT
    assert executable_positions[0][3][8] == "0x" + encode_abi(["bool"], [False]).hex()
    nextCursor = response[1]
    assert nextCursor == 0


@pytest.mark.mainnetFork
def test_returns_executable_compound_position(
    topUpKeeperHelper, decimals, lpToken, topUpAction, alice, dai, pool
):
    create_compound_position(alice, decimals, lpToken, topUpAction, dai, pool)

    response = topUpKeeperHelper.getExecutableTopups(0, 10)
    executable_positions = response[0]
    assert len(executable_positions) == 1
    assert executable_positions[0][0] == alice
    assert executable_positions[0][1] == encode_account(alice)
    assert executable_positions[0][3][0] == scale(10, decimals)
    assert executable_positions[0][3][1] == scale(1, 9)
    assert executable_positions[0][3][2] == scale(5, 9)
    assert executable_positions[0][3][3] == dai
    assert executable_positions[0][3][4] == lpToken
    assert executable_positions[0][3][5] == SINGLE_TOPUP_AMOUNT
    assert executable_positions[0][3][6] == TOTAL_TOPUP_AMOUNT
    assert executable_positions[0][3][7] == TOTAL_TOPUP_AMOUNT
    assert executable_positions[0][3][8] == "0x" + encode_abi(["bool"], [False]).hex()
    nextCursor = response[1]
    assert nextCursor == 0


@pytest.mark.mainnetFork
def test_pagination(
    topUpKeeperHelper, decimals, lpToken, topUpAction, alice, dai, pool, bob, charlie
):
    create_aave_position(alice, decimals, lpToken, topUpAction, dai, pool)
    create_compound_position(alice, decimals, lpToken, topUpAction, dai, pool)
    create_aave_position(bob, decimals, lpToken, topUpAction, dai, pool)
    create_compound_position(bob, decimals, lpToken, topUpAction, dai, pool)
    create_aave_position(charlie, decimals, lpToken, topUpAction, dai, pool)
    create_compound_position(charlie, decimals, lpToken, topUpAction, dai, pool)
    response = topUpKeeperHelper.getExecutableTopups(0, 4)
    executable_positions = response[0]
    assert len(executable_positions) == 4
    nextCursor = response[1]
    assert nextCursor == 2
    response02 = topUpKeeperHelper.getExecutableTopups(nextCursor, 4)
    executable_positions = response02[0]
    assert len(executable_positions) == 2
    nextCursor = response02[1]
    assert nextCursor == 0


@pytest.mark.mainnetFork
def test_filters_unexecutable(
    topUpKeeperHelper, decimals, lpToken, topUpAction, alice, dai, pool, bob, charlie
):
    create_aave_position(alice, decimals, lpToken, topUpAction, dai, pool)
    create_compound_position(alice, decimals, lpToken, topUpAction, dai, pool, False)
    create_aave_position(bob, decimals, lpToken, topUpAction, dai, pool)
    create_compound_position(bob, decimals, lpToken, topUpAction, dai, pool)
    create_aave_position(charlie, decimals, lpToken, topUpAction, dai, pool, False)
    create_compound_position(charlie, decimals, lpToken, topUpAction, dai, pool, False)
    response = topUpKeeperHelper.getExecutableTopups(0, 10)
    executable_positions = response[0]
    assert len(executable_positions) == 3
    nextCursor = response[1]
    assert nextCursor == 0
