import pytest

from support.convert import format_to_bytes
from support.utils import scale
from support.constants import ADMIN_DELAY

WITHDRAW_DELAY = 10 * 86400
INCREASE_DELAY = 20 * 86400

@pytest.fixture
def setup_bkd_locker(bkdLocker, minter, chain, bkdToken, admin):
    bkdLocker.initialize(1e18, 5e18, INCREASE_DELAY, WITHDRAW_DELAY)
    minter.mint_for_testing(admin, 1e18, {"from": admin})
    assert bkdToken.balanceOf(admin) == 1e18
    bkdToken.approve(bkdLocker, 1e18, {"from": admin})
    bkdLocker.lock(1e18, {"from": admin})

    chain.sleep(10)
    chain.mine()
    bkdLocker.userCheckpoint(admin)

@pytest.fixture
def setup_address_provider(mockFeeBurner, address_provider, bkdLocker, rewardHandler):
    address_provider.initializeAddress(format_to_bytes("feeBurner", 32), mockFeeBurner)
    address_provider.initializeAddress(format_to_bytes("bkdLocker", 32), bkdLocker)
    address_provider.initializeAddress(format_to_bytes("rewardHandler", 32), rewardHandler)


@pytest.fixture
def setup_vault(admin, vault, mockStrategy):
    vault.setStrategy(mockStrategy, {"from": admin})
    vault.activateStrategy({"from": admin})
    mockStrategy.setVault(vault, {"from": admin})


@pytest.fixture(scope="module")
def vault2setup(admin,
    MockErc20Vault,
    MockErc20PoolSimple,
    address_provider,
    MockErc20Strategy,
    role_manager,
    MockErc20,
    controller,
    MockLpToken,
    chain):
    underlying = admin.deploy(MockErc20, 6)
    pool = admin.deploy(MockErc20PoolSimple)
    pool.setUnderlying(underlying)
    vault = admin.deploy(MockErc20Vault, controller)
    vault.initialize(
        pool, 0, 0, 0, {"from": admin}
    )
    vault.preparePerformanceFee(scale("0.5"))
    vault.prepareReserveFee(0)
    vault.prepareStrategistFee(0)
    chain.sleep(ADMIN_DELAY)
    vault.executePerformanceFee()
    vault.executeReserveFee()
    vault.executeStrategistFee()

    strategy = admin.deploy(MockErc20Strategy, role_manager, underlying)

    vault.setStrategy(strategy, {"from": admin})
    vault.activateStrategy({"from": admin})
    strategy.setVault(vault, {"from": admin})

    lpToken = admin.deploy(MockLpToken)

    pool.setVault(vault)
    pool.setLpToken(lpToken)

    lpToken.initialize("mockLpToken", "MOCK", 6, pool, {"from": admin})
    address_provider.addPool(pool, {"from": admin})

    return vault, pool, lpToken, underlying, strategy


@pytest.fixture(scope="module")
def vault2(vault2setup):
    return vault2setup[0]


@pytest.fixture(scope="module")
def coin2(vault2setup):
    return vault2setup[3]


@pytest.mark.usefixtures("setup_bkd_locker", "setup_address_provider")
def test_burn_fees(rewardHandler, coin, alice, bkdLocker, admin):
    coin.mint_for_testing(rewardHandler, 100_000 * 1e18, {"from": admin})
    assert coin.balanceOf(rewardHandler) > 0

    tx = rewardHandler.burnFees({"from": alice})

    assert coin.balanceOf(rewardHandler) == 0
    assert tx.events["FeesDeposited"][0]["amount"] == 1e18
    assert tx.events["Burned"][0]["rewardToken"] == bkdLocker.rewardToken()
    assert tx.events["Burned"][0]["totalAmount"] == 1e18


@pytest.mark.usefixtures("setup_bkd_locker", "setup_address_provider")
def test_burn_fees_eth(rewardHandler, mockFeeBurner, alice, bkdLocker, admin):
    alice.transfer(rewardHandler, 1e18)

    assert mockFeeBurner.balance() == 0
    tx = rewardHandler.burnFees({"from": alice})
    assert mockFeeBurner.balance() == 1e18
    assert tx.events["FeesDeposited"][0]["amount"] == 1e18
    assert tx.events["Burned"][0]["rewardToken"] == bkdLocker.rewardToken()
    assert tx.events["Burned"][0]["totalAmount"] == 1e18


@pytest.mark.usefixtures("setup_bkd_locker", "setup_address_provider", "setup_vault")
def test_burn_fees_after_harvest(rewardHandler, mockFeeBurner, coin, decimals, vault, alice, admin):
    strategy = vault.getStrategy()
    amount = 100_000 * 10 ** decimals
    coin.mint_for_testing(strategy, amount, {"from": admin})

    vault.harvest({"from": admin})
    rewardHandler.burnFees({"from": alice})

    assert coin.balanceOf(rewardHandler) == 0
    assert pytest.approx(coin.balanceOf(mockFeeBurner)) == amount * 0.05 * 0.89


@pytest.mark.usefixtures("setup_bkd_locker", "setup_address_provider", "setup_vault")
def test_burn_fees_multiple_vaults(vault2, coin2, rewardHandler, mockFeeBurner, coin, decimals, vault, alice, admin):
    strategy = vault.getStrategy()
    strategy2 = vault2.getStrategy()

    amount = 100_000 * 10 ** decimals
    amount2 = 100_000 * 10 ** 6

    coin.mint_for_testing(strategy, amount, {"from": admin})
    coin2.mint_for_testing(strategy2, amount2, {"from": admin})

    vault.harvest({"from": admin})
    vault2.harvest({"from": admin})

    rewardHandler.burnFees({"from": alice})

    assert coin.balanceOf(rewardHandler) == 0
    assert coin2.balanceOf(rewardHandler) == 0

    assert pytest.approx(coin.balanceOf(mockFeeBurner)) == amount * 0.05 * 0.89
    assert coin2.balanceOf(mockFeeBurner) == amount2 * 0.5

