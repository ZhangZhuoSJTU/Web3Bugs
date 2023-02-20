import pytest
from brownie import ZERO_ADDRESS
from support.constants import ADMIN_DELAY, AddressProviderKeys

from support.types import TopUpRecord
from support.convert import format_to_bytes
from support.utils import encode_account, scale
from support.mainnet_contracts import VendorAddresses, TokenAddresses

AAVE_PROTOCOL = format_to_bytes("Aave", 32)


pytestmark = pytest.mark.usefixtures("initialize_mainnet_topup_action")


@pytest.fixture(scope="module")
def poolSetUp(
    StakerVault,
    admin,
    controller,
    topUpAction,
    Erc20Pool,
    LpToken,
    decimals,
    triCrv,
    address_provider,
):
    pool = admin.deploy(Erc20Pool, controller)
    pool.initialize("3CRV Pool", triCrv, 0, ZERO_ADDRESS, {"from": admin})
    lpToken = admin.deploy(LpToken)
    lpToken.initialize("3CRV - Backd LP", "bkdDAI", decimals, pool, {"from": admin})
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
def triCrvPool(poolSetUp):
    return poolSetUp[0]


@pytest.fixture(scope="module")
def triCrvLpToken(poolSetUp):
    return poolSetUp[1]


@pytest.fixture(scope="module")
def swapper3Crv(admin, Swapper3Crv):
    return admin.deploy(Swapper3Crv)


@pytest.fixture
def swapperSetup(
    admin, address_provider, triCrv, swapperRegistry, swapper3Crv, usdc, chain
):
    swapperRegistry.registerSwapper(triCrv, usdc, swapper3Crv)
    address_provider.initializeAddress(
        AddressProviderKeys.SWAPPER_REGISTRY.value, swapperRegistry, {"from": admin}
    )


@pytest.mark.mainnetFork
@pytest.mark.usefixtures("swapperSetup")
def test_3crv_to_usdc_topup(
    topUpAction, usdc, alice, bob, interface, triCrv, triCrvLpToken, triCrvPool
):
    # Depositing into pool
    total_topup_amount = scale(200_000, 6)
    single_topup_amount = scale(50_000, 6)
    triCrvLpToken.approve(topUpAction, scale(300_000), {"from": alice})
    triCrv.approve(triCrvPool, scale(300_000), {"from": alice})
    triCrvPool.deposit(scale(300_000), 0, {"from": alice})

    # Depositing on Aave
    usdc.approve(VendorAddresses.AAVE_LENDING_POOL, scale(300_000, 6), {"from": alice})
    aaveLendingPool = interface.ILendingPool(VendorAddresses.AAVE_LENDING_POOL)
    aaveLendingPool.deposit(usdc, scale(1000, 6), alice, 0, {"from": alice})

    # Borrowing on Aave
    availableBorrowsETH = aaveLendingPool.getUserAccountData(alice, {"from": alice})[2]
    aaveLendingPool.borrow(
        TokenAddresses.WETH, availableBorrowsETH, 2, 0, alice, {"from": alice}
    )

    # Registering topup
    max_fee = scale(50, 9)
    eth_required_for_gas = 5 * max_fee * topUpAction.getEstimatedGasUsage()
    topup_record = TopUpRecord(
        threshold=scale(2),
        priorityFee=scale(2, 9),
        maxFee=max_fee,
        actionToken=usdc,
        depositToken=triCrvLpToken,
        singleTopUpAmount=single_topup_amount,
        totalTopUpAmount=total_topup_amount,
    )

    topUpAction.register(
        encode_account(alice),
        AAVE_PROTOCOL,
        scale(300_000),
        topup_record,
        {"from": alice, "value": eth_required_for_gas},
    )

    aTokenAddress = aaveLendingPool.getReserveData(usdc)[7]
    aToken = interface.ERC20(aTokenAddress)
    startingBalance = aToken.balanceOf(alice)

    # Executing Topup
    topUpAction.execute(
        alice, encode_account(alice), bob, AAVE_PROTOCOL, {"from": alice}
    )

    # Checking result
    toppedUp = aToken.balanceOf(alice) - startingBalance
    assert toppedUp >= scale(49000, 6)
    assert toppedUp < scale(70000, 6)
