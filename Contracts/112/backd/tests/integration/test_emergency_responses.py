import pytest
from brownie import interface, reverts # type: ignore
from support.utils import scale
from support.constants import ADMIN_DELAY


@pytest.fixture
@pytest.mark.mainnetFork
def newUsdcStrategy(BkdTriHopCvx, alice, mainnet_address_provider, gnosisSafe, mainnet_usdc_vault, strategySwapper):
    return gnosisSafe.deploy(
        BkdTriHopCvx,
        mainnet_usdc_vault,
        alice,
        32,
        "0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B",
        1,
        "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
        1,
        mainnet_address_provider,
        strategySwapper
    )


@pytest.fixture
@pytest.mark.mainnetFork
def newEthStrategy(BkdEthCvx, alice, mainnet_address_provider, gnosisSafe, mainnet_eth_vault, strategySwapper):
    curve_pool_address = "0xDC24316b9AE028F1497c275EB9192a3Ea0f67022"
    convex_pid = 25
    curve_index = 0
    return gnosisSafe.deploy(
        BkdEthCvx, mainnet_eth_vault, alice, convex_pid, curve_pool_address, curve_index, mainnet_address_provider, strategySwapper
    )


@pytest.fixture
@pytest.mark.mainnetFork
def newUsdcVault(Erc20Vault, controller, gnosisSafe, mainnet_usdc_pool):
    vault = gnosisSafe.deploy(Erc20Vault, controller)
    vault.initialize(mainnet_usdc_pool, scale("0.2"), scale(
        "0.9"), scale("0.05"), {"from": gnosisSafe})
    return vault


@pytest.fixture
@pytest.mark.mainnetFork
def newEthVault(EthVault, controller, gnosisSafe, mainnet_eth_pool):
    vault = gnosisSafe.deploy(EthVault, controller)
    vault.initialize(mainnet_eth_pool, scale("0.2"), scale(
        "0.9"), scale("0.05"), {"from": gnosisSafe})
    return vault


@pytest.mark.mainnetFork
def test_pause_pool(mainnet_usdc_pool, gnosisSafe, bob, usdc):
    pausable = interface.IPausable(mainnet_usdc_pool)
    assert pausable.isPaused() == False
    usdc.approve(mainnet_usdc_pool, scale(200, 6), {"from": bob})
    mainnet_usdc_pool.deposit(scale(100, 6), {"from": bob})
    pausable.pause({"from": gnosisSafe})
    assert pausable.isPaused() == True
    with reverts("contract is paused"):
        mainnet_usdc_pool.deposit(scale(100, 6), {"from": bob})
    mainnet_usdc_pool.redeem(scale(10, 6), 0, {"from": bob})
    pausable.unpause({"from": gnosisSafe})
    assert pausable.isPaused() == False
    mainnet_usdc_pool.deposit(scale(100, 6), {"from": bob})


@pytest.mark.mainnetFork
def test_withdraw_all_usdc(mainnet_usdc_pool, gnosisSafe, usdc, mainnet_usdc_vault, mainnet_usdc_strategy):
    # Getting balances before
    pool_total_underlying_before = mainnet_usdc_pool.totalUnderlying()
    assert pool_total_underlying_before > 0
    pool_balance_before = usdc.balanceOf(mainnet_usdc_pool)
    assert pool_balance_before == 0
    vault_balance_before = usdc.balanceOf(mainnet_usdc_vault)
    assert vault_balance_before > 0

    # Processing withdraw all
    mainnet_usdc_pool.withdrawAll({"from": gnosisSafe})

    # Checking balances
    pool_total_underlying_difference = abs(
        mainnet_usdc_pool.totalUnderlying() - pool_total_underlying_before)
    # Checking we didn't lose more than 5% from withdrawal
    assert pool_total_underlying_difference / pool_total_underlying_before < 0.05
    pool_balance_after = usdc.balanceOf(mainnet_usdc_pool)
    assert pool_balance_after > 0
    strategy_balance_after = usdc.balanceOf(mainnet_usdc_strategy)
    assert strategy_balance_after == 0
    vault_balance_after = usdc.balanceOf(mainnet_usdc_vault)
    assert vault_balance_after == 0


@pytest.mark.mainnetFork
def test_withdraw_all_eth(mainnet_eth_pool, gnosisSafe, mainnet_eth_vault, mainnet_eth_strategy):
    # Getting balances before
    pool_total_underlying_before = mainnet_eth_pool.totalUnderlying()
    assert pool_total_underlying_before > 0
    pool_balance_before = mainnet_eth_pool.balance()
    assert pool_balance_before == 0
    vault_balance_before = mainnet_eth_vault.balance()
    assert vault_balance_before > 0

    # Processing withdraw all
    mainnet_eth_pool.withdrawAll({"from": gnosisSafe})

    # Checking balances
    pool_total_underlying_difference = abs(
        mainnet_eth_pool.totalUnderlying() - pool_total_underlying_before)
    # Checking we didn't lose more than 5% from withdrawal
    assert pool_total_underlying_difference / pool_total_underlying_before < 0.05
    pool_balance_after = mainnet_eth_pool.balance()
    assert pool_balance_after > 0
    strategy_balance_after = mainnet_eth_strategy.balance()
    assert strategy_balance_after == 0
    vault_balance_after = mainnet_eth_vault.balance()
    assert vault_balance_after == 0


@pytest.mark.mainnetFork
def test_update_vault_usdc(mainnet_usdc_pool, gnosisSafe, newUsdcVault, chain, bob, usdc, mainnet_chainlink_oracle_provider):
    pool_total_underlying_before = mainnet_usdc_pool.totalUnderlying()
    mainnet_usdc_pool.prepareNewVault(newUsdcVault, {"from": gnosisSafe})
    chain.sleep(ADMIN_DELAY)
    mainnet_chainlink_oracle_provider.setStalePriceDelay(
        ADMIN_DELAY * 2, {"from": gnosisSafe})
    mainnet_usdc_pool.executeNewVault({"from": gnosisSafe})
    pool_total_underlying_difference = abs(
        mainnet_usdc_pool.totalUnderlying() - pool_total_underlying_before)
    # Checking we didn't lose more than 5% from withdrawal
    assert pool_total_underlying_difference / pool_total_underlying_before < 0.05
    usdc.approve(mainnet_usdc_pool, scale(100, 6), {"from": bob})
    mainnet_usdc_pool.deposit(scale(100, 6), {"from": bob})
    mainnet_usdc_pool.redeem(scale(10, 6), 0, {"from": bob})


@pytest.mark.mainnetFork
def test_update_vault_eth(mainnet_eth_pool, gnosisSafe, newEthVault, chain, bob, mainnet_chainlink_oracle_provider):
    pool_total_underlying_before = mainnet_eth_pool.totalUnderlying()
    mainnet_eth_pool.prepareNewVault(newEthVault, {"from": gnosisSafe})
    chain.sleep(ADMIN_DELAY)
    mainnet_chainlink_oracle_provider.setStalePriceDelay(
        ADMIN_DELAY * 2, {"from": gnosisSafe})
    mainnet_eth_pool.executeNewVault({"from": gnosisSafe})
    pool_total_underlying_difference = abs(
        mainnet_eth_pool.totalUnderlying() - pool_total_underlying_before)
    # Checking we didn't lose more than 5% from withdrawal
    assert pool_total_underlying_difference / pool_total_underlying_before < 0.05
    mainnet_eth_pool.deposit(scale(1), {"from": bob, "value": scale(1)})
    mainnet_eth_pool.redeem(scale("0.1"), 0, {"from": bob})


@pytest.mark.mainnetFork
def test_update_strategy_usdc(mainnet_usdc_pool, newUsdcStrategy, gnosisSafe, mainnet_chainlink_oracle_provider, chain, usdc, bob, mainnet_usdc_vault):
    pool_total_underlying_before = mainnet_usdc_pool.totalUnderlying()
    mainnet_usdc_vault.prepareNewStrategy(
        newUsdcStrategy, {"from": gnosisSafe})
    chain.sleep(ADMIN_DELAY * 2)
    mainnet_chainlink_oracle_provider.setStalePriceDelay(
        ADMIN_DELAY * 4, {"from": gnosisSafe})
    mainnet_usdc_vault.executeNewStrategy({"from": gnosisSafe})
    pool_total_underlying_difference = abs(
        mainnet_usdc_pool.totalUnderlying() - pool_total_underlying_before)
    # Checking we didn't lose more than 5% from withdrawal
    assert pool_total_underlying_difference / pool_total_underlying_before < 0.05
    usdc.approve(mainnet_usdc_pool, scale(100, 6), {"from": bob})
    mainnet_usdc_pool.deposit(scale(100, 6), {"from": bob})
    mainnet_usdc_pool.redeem(scale(10, 6), 0, {"from": bob})


@pytest.mark.mainnetFork
def test_update_strategy_eth(mainnet_eth_pool, newEthStrategy, gnosisSafe, mainnet_chainlink_oracle_provider, chain, bob, mainnet_eth_vault):
    pool_total_underlying_before = mainnet_eth_pool.totalUnderlying()
    mainnet_eth_vault.prepareNewStrategy(newEthStrategy, {"from": gnosisSafe})
    chain.sleep(ADMIN_DELAY * 2)
    mainnet_chainlink_oracle_provider.setStalePriceDelay(
        ADMIN_DELAY * 4, {"from": gnosisSafe})
    mainnet_eth_vault.executeNewStrategy({"from": gnosisSafe})
    pool_total_underlying_difference = abs(
        mainnet_eth_pool.totalUnderlying() - pool_total_underlying_before)
    # Checking we didn't lose more than 5% from withdrawal
    assert pool_total_underlying_difference / pool_total_underlying_before < 0.05
    mainnet_eth_pool.deposit(scale(1), {"from": bob, "value": scale(1)})
    mainnet_eth_pool.redeem(scale("0.1"), 0, {"from": bob})
