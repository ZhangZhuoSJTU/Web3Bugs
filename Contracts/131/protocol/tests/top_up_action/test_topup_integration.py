import math

import pytest
from brownie import reverts, ZERO_ADDRESS
from eth_abi.abi import encode_abi
from support.convert import format_to_bytes
from support.mainnet_contracts import TokenAddresses, VendorAddresses
from support.types import TopUpRecord
from support.utils import encode_account, scale
from fixtures.coins import mint_coin_for


AAVE_PROTOCOL = format_to_bytes("Aave", 32)
COMPOUND_PROTOCOL = format_to_bytes("Compound", 32)


# Views


@pytest.mark.mainnetFork
def test_controller_view(topUpAction, controller):
    assert topUpAction.controller() == controller


# Requires


@pytest.mark.mainnetFork
def test_register_fails_with_unsupported_protocol(
    topUpAction, decimals, lpToken, dai, alice
):
    total_topup_amount = scale(10, decimals)
    single_topup_amount = scale(2, decimals)
    lpToken.approve(topUpAction, total_topup_amount, {"from": alice})

    max_fee = scale(50, 9)
    topup_count = math.ceil(total_topup_amount / single_topup_amount)
    eth_required_for_gas = topup_count * max_fee * topUpAction.getEstimatedGasUsage()
    topup_record = TopUpRecord(
        threshold=scale(5),
        priorityFee=scale(2, 9),
        maxFee=max_fee,
        actionToken=dai,
        depositToken=lpToken,
        singleTopUpAmount=single_topup_amount,
        totalTopUpAmount=total_topup_amount,
    )

    with reverts("protocol not found"):
        topUpAction.register(
            encode_account(alice),
            format_to_bytes("Dummy", 32),
            total_topup_amount,
            topup_record,
            {"from": alice, "value": eth_required_for_gas},
        )


# Functions


@pytest.mark.mainnetFork
def test_register(topUpAction, topUpKeeperHelper, decimals, lpToken, dai, alice, pool):
    total_topup_amount = scale(10, decimals)
    single_topup_amount = scale(2, decimals)
    lpToken.approve(topUpAction, total_topup_amount, {"from": alice})
    dai.approve(pool, scale(100, decimals), {"from": alice})
    pool.deposit(scale(100, decimals), 0, {"from": alice})

    assert len(topUpKeeperHelper.listPositions(alice)) == 0

    max_fee = scale(50, 9)
    topup_count = math.ceil(total_topup_amount / single_topup_amount)
    eth_required_for_gas = topup_count * max_fee * topUpAction.getEstimatedGasUsage()
    threshold = scale(5)

    topup_record = TopUpRecord(
        threshold=threshold,
        priorityFee=scale(2, 9),
        maxFee=max_fee,
        actionToken=dai,
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

    alice_positions = topUpKeeperHelper.listPositions(alice)
    assert len(alice_positions) == 1
    assert alice_positions[0][0] == encode_account(alice)
    assert alice_positions[0][2][0] == threshold


@pytest.mark.mainnetFork
def test_reset_position(
    topUpAction, topUpKeeperHelper, decimals, lpToken, dai, alice, pool
):
    total_topup_amount = scale(10, decimals)
    single_topup_amount = scale(2, decimals)
    lpToken.approve(topUpAction, total_topup_amount, {"from": alice})
    dai.approve(pool, scale(100, decimals), {"from": alice})
    pool.deposit(scale(100, decimals), 0, {"from": alice})

    max_fee = scale(50, 9)
    eth_required_for_gas = 5 * max_fee * topUpAction.getEstimatedGasUsage()
    topup_record = TopUpRecord(
        threshold=scale("1.5", decimals),
        priorityFee=scale(2, 9),
        maxFee=max_fee,
        actionToken=dai,
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

    assert len(topUpKeeperHelper.listPositions(alice)) == 1
    topUpAction.resetPosition(
        encode_account(alice), AAVE_PROTOCOL, False, {"from": alice}
    )
    assert len(topUpKeeperHelper.listPositions(alice)) == 0


@pytest.mark.mainnetFork
def test_reset_position_unstake(
    topUpAction, topUpKeeperHelper, decimals, lpToken, dai, alice, pool
):
    total_topup_amount = scale(10, decimals)
    single_topup_amount = scale(2, decimals)
    lpToken.approve(topUpAction, total_topup_amount, {"from": alice})
    dai.approve(pool, scale(100, decimals), {"from": alice})
    pool.deposit(scale(100, decimals), 0, {"from": alice})

    max_fee = scale(50, 9)
    eth_required_for_gas = 5 * max_fee * topUpAction.getEstimatedGasUsage()
    topup_record = TopUpRecord(
        threshold=scale("1.5", decimals),
        priorityFee=scale(2, 9),
        maxFee=max_fee,
        actionToken=dai,
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

    assert len(topUpKeeperHelper.listPositions(alice)) == 1
    topUpAction.resetPosition(
        encode_account(alice), AAVE_PROTOCOL, True, {"from": alice}
    )
    assert len(topUpKeeperHelper.listPositions(alice)) == 0


@pytest.mark.mainnetFork
def test_execute_aave(topUpAction, decimals, lpToken, dai, alice, pool, bob, interface):
    # Depositing into pool
    total_topup_amount = scale(10, decimals)
    single_topup_amount = scale(2, decimals)
    lpToken.approve(topUpAction, total_topup_amount, {"from": alice})
    dai.approve(pool, scale(100, decimals), {"from": alice})
    pool.deposit(scale(100, decimals), 0, {"from": alice})

    # Depositing on Aave
    dai.approve(
        VendorAddresses.AAVE_LENDING_POOL, scale(100000, decimals), {"from": alice}
    )
    aaveLendingPool = interface.ILendingPool(VendorAddresses.AAVE_LENDING_POOL)
    aaveLendingPool.deposit(dai, scale(1000, decimals), alice, 0, {"from": alice})

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
        actionToken=dai,
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

    aTokenAddress = aaveLendingPool.getReserveData(dai)[7]
    aToken = interface.ERC20(aTokenAddress)
    startingBalance = aToken.balanceOf(alice)

    # Executing Topup
    topUpAction.execute(
        alice, encode_account(alice), bob, AAVE_PROTOCOL, {"from": alice}
    )

    # Checking result
    toppedUp = aToken.balanceOf(alice) - startingBalance
    assert toppedUp >= scale("1.999", decimals)
    assert toppedUp < scale("2.001", decimals)


@pytest.mark.mainnetFork
def test_execute_compound(
    topUpAction, decimals, lpToken, dai, alice, pool, bob, interface
):
    # Depositing into pool
    total_topup_amount = scale(10, decimals)
    single_topup_amount = scale(2, decimals)
    lpToken.approve(topUpAction, total_topup_amount, {"from": alice})
    dai.approve(pool, scale(100, decimals), {"from": alice})
    pool.deposit(scale(100, decimals), 0, {"from": alice})

    # Depositing on Compound
    cDai = interface.CToken(TokenAddresses.C_DAI)
    dai.approve(cDai, scale(100000, decimals), {"from": alice})
    cDai.mint(scale(10000, decimals), {"from": alice})
    assert cDai.balanceOf(alice) > 0
    comptroller = interface.Comptroller(VendorAddresses.COMPOUND_COMPTROLLER)
    comptroller.enterMarkets([TokenAddresses.C_DAI], {"from": alice})

    # Borrowing on Compound
    cEth = interface.CToken(TokenAddresses.C_ETH)
    balanceBefore = alice.balance()
    cEth.borrow(scale(1, decimals), {"from": alice})
    cEth.borrowBalanceCurrent(alice, {"from": alice})
    # does not seem to always give back 1 ETH when borrowing
    assert alice.balance() - balanceBefore >= scale("0.95", decimals)
    assert alice.balance() - balanceBefore < scale(2, decimals)

    # Registering Topup
    max_fee = scale(50, 9)
    eth_required_for_gas = 5 * max_fee * topUpAction.getEstimatedGasUsage()
    topup_record = TopUpRecord(
        threshold=scale(10, decimals),
        priorityFee=scale(2, 9),
        maxFee=max_fee,
        actionToken=dai,
        depositToken=lpToken,
        singleTopUpAmount=single_topup_amount,
        totalTopUpAmount=total_topup_amount,
    )

    topUpAction.register(
        encode_account(alice),
        COMPOUND_PROTOCOL,
        total_topup_amount,
        topup_record,
        {"from": alice, "value": eth_required_for_gas},
    )

    # Executing Topup
    exchangeRate = cDai.exchangeRateStored() / scale(1, decimals)
    startingBalance = cDai.balanceOf(alice) * exchangeRate
    topUpAction.execute(
        alice, encode_account(alice), bob, COMPOUND_PROTOCOL, {"from": alice}
    )

    # Checking result
    toppedUp = (cDai.balanceOf(alice) * exchangeRate) - startingBalance
    assert toppedUp > scale("1.9", decimals)
    assert toppedUp < scale("2.1", decimals)


@pytest.mark.mainnetFork
def test_execute_aave_repay_debt(
    topUpAction, decimals, lpToken, dai, alice, pool, bob, crv, interface
):
    # Depositing into pool
    total_topup_amount = scale(10, decimals)
    single_topup_amount = scale(2, decimals)
    lpToken.approve(topUpAction, total_topup_amount, {"from": alice})
    dai.approve(pool, scale(100, decimals), {"from": alice})
    pool.deposit(scale(100, decimals), 0, {"from": alice})

    # Depositing on Aave
    crv.approve(
        VendorAddresses.AAVE_LENDING_POOL, scale(100000, decimals), {"from": alice}
    )
    aaveLendingPool = interface.ILendingPool(VendorAddresses.AAVE_LENDING_POOL)
    aaveLendingPool.deposit(crv, scale(10000, decimals), alice, 0, {"from": alice})

    # Borrowing on Aave
    aaveLendingPool.borrow(dai, scale(1000, decimals), 2, 0, alice, {"from": alice})

    # Registering Topup
    max_fee = scale(50, 9)
    eth_required_for_gas = 5 * max_fee * topUpAction.getEstimatedGasUsage()
    topup_record = TopUpRecord(
        threshold=scale(18, decimals),
        priorityFee=scale(2, 9),
        maxFee=max_fee,
        actionToken=dai,
        depositToken=lpToken,
        singleTopUpAmount=single_topup_amount,
        totalTopUpAmount=total_topup_amount,
        extra="0x" + encode_abi(["bool"], [True]).hex(),
    )

    topUpAction.register(
        encode_account(alice),
        AAVE_PROTOCOL,
        total_topup_amount,
        topup_record,
        {"from": alice, "value": eth_required_for_gas},
    )

    # Executing Topup
    aTokenAddress = aaveLendingPool.getReserveData(dai)[7]
    aToken = interface.ERC20(aTokenAddress)
    startingBalance = aToken.balanceOf(alice)
    topUpAction.execute(
        alice, encode_account(alice), bob, AAVE_PROTOCOL, {"from": alice}
    )

    # Checking result
    toppedUp = aToken.balanceOf(alice) - startingBalance
    assert toppedUp == 0


@pytest.mark.mainnetFork
def test_execute_compound_repay_debt(
    topUpAction, decimals, lpToken, dai, alice, pool, bob, interface
):
    # Depositing into pool
    total_topup_amount = scale(1000, decimals)
    single_topup_amount = scale(200, decimals)
    lpToken.approve(topUpAction, total_topup_amount, {"from": alice})
    dai.approve(pool, scale(2000, decimals), {"from": alice})
    pool.deposit(scale(2000, decimals), 0, {"from": alice})

    # Depositing on Compound
    cEth = interface.CEthToken(TokenAddresses.C_ETH)
    cEth.mint({"from": alice, "value": scale(5, decimals)})
    assert cEth.balanceOf(alice) > 0
    comptroller = interface.Comptroller(VendorAddresses.COMPOUND_COMPTROLLER)
    comptroller.enterMarkets([TokenAddresses.C_ETH], {"from": alice})

    # Borrowing on Compound
    cDai = interface.CToken(TokenAddresses.C_DAI)
    balanceBefore = dai.balanceOf(alice)
    cDai.borrow(scale(1000, decimals), {"from": alice})
    cDai.borrowBalanceCurrent(alice, {"from": alice})
    assert dai.balanceOf(alice) - balanceBefore >= scale(999, decimals)
    assert dai.balanceOf(alice) - balanceBefore < scale(2000, decimals)

    # Registering Topup
    max_fee = scale(50, 9)
    eth_required_for_gas = 5 * max_fee * topUpAction.getEstimatedGasUsage()
    topup_record = TopUpRecord(
        threshold=scale(18, decimals),
        priorityFee=scale(2, 9),
        maxFee=max_fee,
        actionToken=dai,
        depositToken=lpToken,
        singleTopUpAmount=single_topup_amount,
        totalTopUpAmount=total_topup_amount,
        extra="0x" + encode_abi(["bool"], [True]).hex(),
    )

    topUpAction.register(
        encode_account(alice),
        COMPOUND_PROTOCOL,
        total_topup_amount,
        topup_record,
        {"from": alice, "value": eth_required_for_gas},
    )

    # Executing Topup
    startingBalance = cEth.balanceOf(alice)
    cDai.borrowBalanceCurrent(alice, {"from": alice})
    debtBefore = cDai.borrowBalanceStored(alice)

    topUpAction.execute(
        alice, encode_account(alice), bob, COMPOUND_PROTOCOL, {"from": alice}
    )

    # Checking result
    assert cEth.balanceOf(alice) == startingBalance
    cDai.borrowBalanceCurrent(alice, {"from": alice})
    debtAfter = cDai.borrowBalanceStored(alice)
    assert debtBefore - debtAfter >= scale(190, decimals)
    assert debtBefore - debtAfter < scale(210, decimals)


@pytest.fixture(scope="module")
def usdtPoolSetUp(
    StakerVault,
    admin,
    controller,
    address_provider,
    topUpAction,
    Erc20Pool,
    usdt,
    LpToken,
    decimals,
):
    pool = admin.deploy(Erc20Pool, controller)
    pool.initialize("DAI Pool", usdt, ZERO_ADDRESS, {"from": admin})
    lpToken = admin.deploy(LpToken)
    lpToken.initialize("DAI - Backd LP", "bkdDAI", decimals, pool, {"from": admin})
    stakerVault = admin.deploy(StakerVault, controller)
    stakerVault.initialize(lpToken, {"from": admin})
    address_provider.addAction(topUpAction, {"from": admin})
    controller.addStakerVault(stakerVault, {"from": admin})
    pool.setLpToken(lpToken, {"from": admin})
    pool.setStaker({"from": admin})
    address_provider.addPool(pool, {"from": admin})
    topUpAction.addUsableToken(lpToken, {"from": admin})
    return pool, lpToken, stakerVault


@pytest.fixture(scope="module")
def usdtPool(usdtPoolSetUp):
    return usdtPoolSetUp[0]


@pytest.fixture(scope="module")
def usdtLpToken(usdtPoolSetUp):
    return usdtPoolSetUp[1]


@pytest.mark.mainnetFork
def test_register_twice_with_usdt(topUpAction, topUpKeeperHelper, usdtLpToken, usdt, alice, usdtPool):
    total_topup_amount = scale(10, 6)
    single_topup_amount = scale(2, 6)
    usdtLpToken.approve(topUpAction, total_topup_amount, {"from": alice})
    usdt.approve(usdtPool, scale(100, 6), {"from": alice})
    usdtPool.deposit(scale(100, 6), 0, {"from": alice})

    assert len(topUpKeeperHelper.listPositions(alice)) == 0

    max_fee = scale(50, 9)
    topup_count = math.ceil(total_topup_amount / single_topup_amount)
    eth_required_for_gas = topup_count * max_fee * topUpAction.getEstimatedGasUsage()
    threshold = scale(5)

    topup_record = TopUpRecord(
        threshold=threshold,
        priorityFee=scale(2, 9),
        maxFee=max_fee,
        actionToken=usdt,
        depositToken=usdtLpToken,
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

    alice_positions = topUpKeeperHelper.listPositions(alice)
    assert len(alice_positions) == 1
    assert alice_positions[0][0] == encode_account(alice)
    assert alice_positions[0][2][0] == threshold


    topUpAction.resetPosition(encode_account(alice), AAVE_PROTOCOL, True, {"from": alice})

    alice_positions = topUpKeeperHelper.listPositions(alice)
    assert len(alice_positions) == 0

    usdtLpToken.approve(topUpAction, total_topup_amount, {"from": alice})
    topUpAction.register(
        encode_account(alice),
        AAVE_PROTOCOL,
        total_topup_amount,
        topup_record,
        {"from": alice, "value": eth_required_for_gas},
    )

    alice_positions = topUpKeeperHelper.listPositions(alice)
    assert len(alice_positions) == 1
