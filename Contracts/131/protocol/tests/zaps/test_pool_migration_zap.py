import pytest
from brownie import ZERO_ADDRESS
from support.utils import scale
from support.constants import ADMIN_DELAY, AddressProviderKeys
from support.mainnet_contracts import TokenAddresses


pool_datas = [
    {
        "underlying": TokenAddresses.DAI,
        "symbol": "DAI",
        "decimals": 18,
    },
    {
        "underlying": TokenAddresses.ETH,
        "symbol": "ETH",
        "decimals": 18,
    },
    {
        "underlying": TokenAddresses.USDC,
        "symbol": "USDC",
        "decimals": 6,
    },
]


@pytest.fixture(scope="module")
def oldAddressProvider(
    StakerVault,
    admin,
    treasury,
    Controller,
    oracleProvider,
    vaultReserve,
    LpToken,
    AddressProvider,
    EthPool,
    Erc20Pool,
    RoleManager,
    MockInflationManager,
    chain,
):
    address_provider = admin.deploy(AddressProvider, treasury)
    role_manager = admin.deploy(RoleManager, address_provider)
    address_provider.initialize(role_manager, {"from": admin})
    inflation_manager = admin.deploy(MockInflationManager, address_provider)
    controller = admin.deploy(Controller, address_provider)
    controller.setInflationManager(inflation_manager, {"from": admin})
    address_provider.initializeAddress(
        AddressProviderKeys.CONTROLLER.value, controller, {"from": admin}
    )
    address_provider.initializeAddress(
        AddressProviderKeys.VAULT_RESERVE.value, vaultReserve, {"from": admin}
    )
    address_provider.initializeAddress(
        AddressProviderKeys.ORACLE_PROVIDER.value, oracleProvider, {"from": admin}
    )

    for pool_data in pool_datas:
        underlying = pool_data["underlying"]
        symbol = pool_data["symbol"]
        decimals = pool_data["decimals"]

        if underlying == TokenAddresses.ETH:
            pool = admin.deploy(EthPool, controller)
            pool.initialize(symbol + " Pool", ZERO_ADDRESS, {"from": admin})
        else:
            pool = admin.deploy(Erc20Pool, controller)
            pool.initialize(symbol + " Pool", underlying, ZERO_ADDRESS, {"from": admin})
        lpToken = admin.deploy(LpToken)
        lpToken.initialize(
            symbol + " - Backd LP", "bkd" + symbol, decimals, pool, {"from": admin}
        )
        stakerVault = admin.deploy(StakerVault, controller)
        stakerVault.initialize(lpToken, {"from": admin})
        controller.addStakerVault(stakerVault, {"from": admin})
        pool.setLpToken(lpToken, {"from": admin})
        pool.setStaker({"from": admin})
        address_provider.addPool(pool, {"from": admin})

        pool.prepareNewMinWithdrawalFee(0, {"from": admin})
        pool.prepareNewMaxWithdrawalFee(0, {"from": admin})

        chain.sleep(ADMIN_DELAY)

        pool.executeNewMinWithdrawalFee({"from": admin})
        pool.executeNewMaxWithdrawalFee({"from": admin})

    return address_provider


@pytest.fixture(scope="module")
def newAddressProvider(
    StakerVault,
    admin,
    treasury,
    Controller,
    oracleProvider,
    vaultReserve,
    Erc20Pool,
    EthPool,
    LpToken,
    AddressProvider,
    MockInflationManager,
    RoleManager,
):
    address_provider = admin.deploy(AddressProvider, treasury)
    role_manager = admin.deploy(RoleManager, address_provider)
    address_provider.initialize(role_manager, {"from": admin})
    inflation_manager = admin.deploy(MockInflationManager, address_provider)
    controller = admin.deploy(Controller, address_provider)
    controller.setInflationManager(inflation_manager, {"from": admin})
    address_provider.initializeAddress(
        AddressProviderKeys.CONTROLLER.value, controller, {"from": admin}
    )
    address_provider.initializeAddress(
        AddressProviderKeys.VAULT_RESERVE.value, vaultReserve, {"from": admin}
    )
    address_provider.initializeAddress(
        AddressProviderKeys.ORACLE_PROVIDER.value, oracleProvider, {"from": admin}
    )

    for pool_data in pool_datas:
        underlying = pool_data["underlying"]
        symbol = pool_data["symbol"]
        decimals = pool_data["decimals"]

        if underlying == TokenAddresses.ETH:
            pool = admin.deploy(EthPool, controller)
            pool.initialize(symbol + " Pool", ZERO_ADDRESS, {"from": admin})
        else:
            pool = admin.deploy(Erc20Pool, controller)
            pool.initialize(symbol + " Pool", underlying, ZERO_ADDRESS, {"from": admin})
        lpToken = admin.deploy(LpToken)
        lpToken.initialize(
            symbol + " - Backd LP", "bkd" + symbol, decimals, pool, {"from": admin}
        )
        stakerVault = admin.deploy(StakerVault, controller)
        stakerVault.initialize(lpToken, {"from": admin})
        controller.addStakerVault(stakerVault, {"from": admin})
        pool.setLpToken(lpToken, {"from": admin})
        pool.setStaker({"from": admin})
        address_provider.addPool(pool, {"from": admin})

    return address_provider


@pytest.fixture(scope="module")
def poolMigrationZap(PoolMigrationZap, admin, newAddressProvider):
    return admin.deploy(PoolMigrationZap, newAddressProvider)


@pytest.mark.mainnetFork
def test_migrate_usdc(
    newAddressProvider,
    oldAddressProvider,
    Erc20Pool,
    usdc,
    alice,
    LpToken,
    poolMigrationZap,
):
    # Depositing into old pool
    AMOUNT = scale(100_000, 6)
    old_usdc_pool_address = oldAddressProvider.allPools()[2]
    old_usdc_pool = Erc20Pool.at(old_usdc_pool_address)
    assert old_usdc_pool.getUnderlying() == TokenAddresses.USDC
    old_usdc_lp_token_address = old_usdc_pool.getLpToken()
    old_usdc_lp_token = LpToken.at(old_usdc_lp_token_address)
    usdc.approve(old_usdc_pool, AMOUNT, {"from": alice})
    old_usdc_lp_token.approve(poolMigrationZap, AMOUNT, {"from": alice})
    assert old_usdc_lp_token.balanceOf(alice) == 0
    assert old_usdc_pool.getUnderlying() == usdc
    old_usdc_pool.deposit(AMOUNT, {"from": alice})
    assert old_usdc_lp_token.balanceOf(alice) == AMOUNT

    # Migrating to new pool
    new_usdc_pool_address = newAddressProvider.allPools()[2]
    new_usdc_pool = Erc20Pool.at(new_usdc_pool_address)
    assert new_usdc_pool.getUnderlying() == TokenAddresses.USDC
    new_usdc_lp_token_address = new_usdc_pool.getLpToken()
    new_usdc_lp_token = LpToken.at(new_usdc_lp_token_address)
    assert new_usdc_lp_token.balanceOf(alice) == 0
    poolMigrationZap.migrate(old_usdc_pool_address, {"from": alice})
    assert new_usdc_lp_token.balanceOf(alice) == AMOUNT


@pytest.mark.mainnetFork
def test_migrate_dai(
    newAddressProvider,
    oldAddressProvider,
    Erc20Pool,
    dai,
    alice,
    LpToken,
    poolMigrationZap,
):
    # Depositing into old pool
    AMOUNT = scale(100_000, 18)
    old_dai_pool_address = oldAddressProvider.allPools()[0]
    old_dai_pool = Erc20Pool.at(old_dai_pool_address)
    assert old_dai_pool.getUnderlying() == TokenAddresses.DAI
    old_dai_lp_token_address = old_dai_pool.getLpToken()
    old_dai_lp_token = LpToken.at(old_dai_lp_token_address)
    dai.approve(old_dai_pool, AMOUNT, {"from": alice})
    old_dai_lp_token.approve(poolMigrationZap, AMOUNT, {"from": alice})
    assert old_dai_lp_token.balanceOf(alice) == 0
    assert old_dai_pool.getUnderlying() == dai
    old_dai_pool.deposit(AMOUNT, {"from": alice})
    assert old_dai_lp_token.balanceOf(alice) == AMOUNT

    # Migrating to new pool
    new_dai_pool_address = newAddressProvider.allPools()[0]
    new_dai_pool = Erc20Pool.at(new_dai_pool_address)
    assert new_dai_pool.getUnderlying() == TokenAddresses.DAI
    new_dai_lp_token_address = new_dai_pool.getLpToken()
    new_dai_lp_token = LpToken.at(new_dai_lp_token_address)
    assert new_dai_lp_token.balanceOf(alice) == 0
    poolMigrationZap.migrate(old_dai_pool_address, {"from": alice})
    assert new_dai_lp_token.balanceOf(alice) == AMOUNT


@pytest.mark.mainnetFork
def test_migrate_eth(
    newAddressProvider,
    oldAddressProvider,
    EthPool,
    alice,
    LpToken,
    poolMigrationZap,
):
    # Depositing into old pool
    AMOUNT = scale(2, 18)
    old_eth_pool_address = oldAddressProvider.allPools()[1]
    old_eth_pool = EthPool.at(old_eth_pool_address)
    assert old_eth_pool.getUnderlying() == TokenAddresses.ETH
    old_eth_lp_token_address = old_eth_pool.getLpToken()
    old_eth_lp_token = LpToken.at(old_eth_lp_token_address)
    old_eth_lp_token.approve(poolMigrationZap, AMOUNT, {"from": alice})
    assert old_eth_lp_token.balanceOf(alice) == 0
    assert old_eth_pool.getUnderlying() == TokenAddresses.ETH
    old_eth_pool.deposit(AMOUNT, {"from": alice, "value": AMOUNT})
    assert old_eth_lp_token.balanceOf(alice) == AMOUNT

    # Migrating to new pool
    new_eth_pool_address = newAddressProvider.allPools()[1]
    new_eth_pool = EthPool.at(new_eth_pool_address)
    assert new_eth_pool.getUnderlying() == TokenAddresses.ETH
    new_lp_token_address = new_eth_pool.getLpToken()
    new_lp_token = LpToken.at(new_lp_token_address)
    assert new_lp_token.balanceOf(alice) == 0
    poolMigrationZap.migrate(old_eth_pool_address, {"from": alice})
    assert new_lp_token.balanceOf(alice) == AMOUNT


@pytest.mark.mainnetFork
def test_migrate_all(
    newAddressProvider,
    oldAddressProvider,
    Erc20Pool,
    EthPool,
    alice,
    LpToken,
    poolMigrationZap,
    usdc,
    dai,
):
    # Depositing USDC into old pool
    USDC_AMOUNT = scale(100_000, 6)
    old_usdc_pool_address = oldAddressProvider.allPools()[2]
    old_usdc_pool = Erc20Pool.at(old_usdc_pool_address)
    old_usdc_lp_token_address = old_usdc_pool.getLpToken()
    old_usdc_lp_token = LpToken.at(old_usdc_lp_token_address)
    usdc.approve(old_usdc_pool, USDC_AMOUNT, {"from": alice})
    old_usdc_lp_token.approve(poolMigrationZap, USDC_AMOUNT, {"from": alice})
    old_usdc_pool.deposit(USDC_AMOUNT, {"from": alice})
    assert old_usdc_lp_token.balanceOf(alice) == USDC_AMOUNT

    # Depositing DAI into old pool
    DAI_AMOUNT = scale(100_000, 18)
    old_dai_pool_address = oldAddressProvider.allPools()[0]
    old_dai_pool = Erc20Pool.at(old_dai_pool_address)
    old_dai_lp_token_address = old_dai_pool.getLpToken()
    old_dai_lp_token = LpToken.at(old_dai_lp_token_address)
    dai.approve(old_dai_pool, DAI_AMOUNT, {"from": alice})
    old_dai_lp_token.approve(poolMigrationZap, DAI_AMOUNT, {"from": alice})
    old_dai_pool.deposit(DAI_AMOUNT, {"from": alice})
    assert old_dai_lp_token.balanceOf(alice) == DAI_AMOUNT

    # Depositing ETH into old pool
    ETH_AMOUNT = scale(2, 18)
    old_eth_pool_address = oldAddressProvider.allPools()[1]
    old_eth_pool = EthPool.at(old_eth_pool_address)
    old_eth_lp_token_address = old_eth_pool.getLpToken()
    old_eth_lp_token = LpToken.at(old_eth_lp_token_address)
    old_eth_lp_token.approve(poolMigrationZap, ETH_AMOUNT, {"from": alice})
    old_eth_pool.deposit(ETH_AMOUNT, {"from": alice, "value": ETH_AMOUNT})
    assert old_eth_lp_token.balanceOf(alice) == ETH_AMOUNT

    # Migating all
    new_usdc_pool_address = newAddressProvider.allPools()[2]
    new_usdc_pool = Erc20Pool.at(new_usdc_pool_address)
    new_usdc_lp_token_address = new_usdc_pool.getLpToken()
    new_usdc_lp_token = LpToken.at(new_usdc_lp_token_address)
    new_dai_pool_address = newAddressProvider.allPools()[0]
    new_dai_pool = Erc20Pool.at(new_dai_pool_address)
    new_dai_lp_token_address = new_dai_pool.getLpToken()
    new_dai_lp_token = LpToken.at(new_dai_lp_token_address)
    new_eth_pool_address = newAddressProvider.allPools()[1]
    new_eth_pool = EthPool.at(new_eth_pool_address)
    new_lp_token_address = new_eth_pool.getLpToken()
    new_lp_token = LpToken.at(new_lp_token_address)
    poolMigrationZap.migrateAll(
        [old_usdc_pool_address, old_dai_pool_address, old_eth_pool_address],
        {"from": alice},
    )
    assert new_usdc_lp_token.balanceOf(alice) == USDC_AMOUNT
    assert new_dai_lp_token.balanceOf(alice) == DAI_AMOUNT
    assert new_lp_token.balanceOf(alice) == ETH_AMOUNT
