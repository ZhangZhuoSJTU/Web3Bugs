import brownie
from brownie import ZERO_ADDRESS
import pytest


@pytest.fixture(scope="module")
def some_pool(MockErc20, MockErc20Pool, admin, controller, LpToken):
    coin = admin.deploy(MockErc20, 18)
    pool = admin.deploy(MockErc20Pool, controller)
    lp_token = admin.deploy(LpToken)
    pool.initialize("some-pool", coin, ZERO_ADDRESS)
    lp_token.initialize("Some LP", "SLP", 18, pool)
    pool.setLpToken(lp_token, {"from": admin})
    return pool


@pytest.fixture(scope="module")
def set_vault(some_pool, admin, Erc20Vault, controller):
    vault = admin.deploy(Erc20Vault, controller)
    vault.initialize(some_pool, 0, 0, 0, {"from": admin})
    some_pool.setVault(vault, False, {"from": admin})


def test_add_pool(some_pool, admin, alice, address_provider):
    with brownie.reverts("unauthorized access"):
        address_provider.addPool(some_pool, {"from": alice})

    tx = address_provider.addPool(some_pool, {"from": admin})
    assert len(tx.events) == 1
    assert tx.events[0]["pool"] == some_pool
    assert address_provider.allPools() == [some_pool]
    assert address_provider.getPoolForToken(some_pool.lpToken()) == some_pool
    assert len(address_provider.allVaults()) == 0


@pytest.mark.usefixtures("set_vault")
def test_add_pool_with_vault(some_pool, admin, alice, address_provider):
    with brownie.reverts("unauthorized access"):
        address_provider.addPool(some_pool, {"from": alice})

    tx = address_provider.addPool(some_pool, {"from": admin})
    assert len(tx.events) == 1
    assert tx.events[0]["pool"] == some_pool
    assert address_provider.allPools() == [some_pool]
    assert address_provider.getPoolForToken(some_pool.lpToken()) == some_pool
    assert address_provider.allVaults() == [some_pool.getVault()]


def test_add_existing_pool(some_pool, admin, address_provider):
    address_provider.addPool(some_pool, {"from": admin})
    tx = address_provider.addPool(some_pool, {"from": admin})
    assert len(tx.events) == 0
    assert len(address_provider.allPools()) == 1
    assert len(address_provider.allVaults()) == 1


def remove_existing_pool(
    EthPool,
    EthVault,
    LpToken,
    some_pool,
    admin,
    alice,
    controller,
    address_provider,
):
    otherPool = admin.deploy(EthPool, controller)
    otherLpToken = admin.deploy(LpToken)
    otherPool.initialize("eth-pool", ZERO_ADDRESS)
    otherLpToken.initialize("Other LP", "OLP", 18, otherPool)
    otherPool.setLpToken(otherLpToken, {"from": admin})
    otherVault = admin.deploy(EthVault, controller)
    otherVault.initialize(otherPool, 0, 0, 0, {"from": admin})
    otherPool.setVault(otherVault, False, {"from": admin})

    address_provider.addPool(some_pool, {"from": admin})
    address_provider.addPool(otherPool, {"from": admin})

    print(some_pool)
    print(otherPool)
    print(address_provider.allPools())

    assert set(address_provider.allPools()) == set(
        [some_pool.address, otherPool.address]
    )
    assert set(address_provider.allVaults()) == set(
        [some_pool.getVault(), otherPool.getVault()]
    )
    with brownie.reverts("unauthorized access"):
        controller.removePool(some_pool, {"from": alice})

    tx = controller.removePool(some_pool, {"from": admin})
    assert len(tx.events["PoolDelisted"]) == 1
    assert tx.events["PoolDelisted"][0]["pool"] == some_pool
    assert address_provider.allPools() == [otherPool.address]
    assert address_provider.allVaults() == [otherPool.getVault()]
    assert address_provider.safeGetPoolForToken(some_pool.lpToken()) == ZERO_ADDRESS
    assert address_provider.getPoolForToken(otherPool.lpToken()) == otherPool

    controller.removePool(otherPool, {"from": admin})
    assert address_provider.allPools() == []
    assert address_provider.allVaults() == []
    assert address_provider.safeGetPoolForToken(otherPool.lpToken()) == ZERO_ADDRESS


@pytest.mark.usefixtures("set_vault")
def test_remove_existing_pool(
    MockEthPool,
    EthVault,
    LpToken,
    some_pool,
    admin,
    alice,
    controller,
    address_provider,
):
    remove_existing_pool(
        MockEthPool,
        EthVault,
        LpToken,
        some_pool,
        admin,
        alice,
        controller,
        address_provider,
    )


@pytest.mark.usefixtures("inflation_kickoff")
def test_remove_existing_pool_with_inflation(
    MockEthPool,
    EthVault,
    LpToken,
    pool_with_vault,
    admin,
    alice,
    controller,
    address_provider,
    inflation_manager,
    stakerVault,
):
    assert inflation_manager.getLpRateForStakerVault(stakerVault) != 0
    remove_existing_pool(
        MockEthPool,
        EthVault,
        LpToken,
        pool_with_vault,
        admin,
        alice,
        controller,
        address_provider,
    )
    assert inflation_manager.getLpRateForStakerVault(stakerVault) == 0


def test_ignore_unregistered_pool(admin, controller, EthPool):
    otherPool = admin.deploy(EthPool, controller)
    tx = controller.removePool(otherPool, {"from": admin})
    assert len(tx.events) == 0
