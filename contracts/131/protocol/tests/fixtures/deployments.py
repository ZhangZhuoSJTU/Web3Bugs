import pytest

from brownie import ZERO_ADDRESS
from support.constants import ADMIN_DELAY, AddressProviderKeys
from support.mainnet_contracts import VendorAddresses, TokenAddresses
from support.convert import format_to_bytes
from support.utils import scale


AAVE_PROTOCOL = format_to_bytes("Aave", 32)
COMPOUND_PROTOCOL = format_to_bytes("Compound", 32)


def _pool(
    project,
    StakerVault,
    MockLpToken,
    admin,
    coin,
    pool_data,
    action,
    controller,
    address_provider,
    name="MOCK-POOL",
    symbol="MOK",
):
    deployer = getattr(project, pool_data["pool_contract"])

    args = (name,)

    if coin != ZERO_ADDRESS:
        args += (coin,)

    deployment_args = args + (ZERO_ADDRESS, ({"from": admin}))

    contract = deployer.deploy(controller, {"from": admin})
    contract.initialize(*deployment_args)

    # create LP token of pool
    if coin == ZERO_ADDRESS:
        lpToken = admin.deploy(MockLpToken)
        lpToken.initialize("ETH - Backd LP", "bkdETH", 18, contract, {"from": admin})
    else:
        name = coin.name() + "- Backd LP"
        symbol = "bkd" + coin.symbol()
        decimals = coin.decimals()
        lpToken = admin.deploy(MockLpToken)
        lpToken.initialize(name, symbol, decimals, contract, {"from": admin})

    # create staker vault for lp Token
    stakerVault = admin.deploy(StakerVault, controller)
    stakerVault.initialize(lpToken, {"from": admin})

    # configure controller
    address_provider.addAction(action, {"from": admin})
    controller.addStakerVault(stakerVault, {"from": admin})

    # pool set up
    contract.setLpToken(lpToken, {"from": admin})
    # gets staker vault info from controller
    contract.setStaker({"from": admin})

    # dev: once more actions used, this line should be changed!
    action.addUsableToken(lpToken, {"from": admin})

    address_provider.addPool(contract, {"from": admin})

    return contract, lpToken, stakerVault


@pytest.fixture(scope="module")
def poolSetUp(
    pool_data,
    StakerVault,
    MockLpToken,
    admin,
    project,
    coin,
    controller,
    address_provider,
    topUpAction,
    isForked,
    Erc20Pool,
    dai,
    LpToken,
    decimals,
):
    if isForked:
        pool = admin.deploy(Erc20Pool, controller)
        pool.initialize("DAI Pool", dai, ZERO_ADDRESS, {"from": admin})
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
    return _pool(
        project,
        StakerVault,
        MockLpToken,
        admin,
        coin,
        pool_data,
        topUpAction,
        controller,
        address_provider,
    )


@pytest.fixture(scope="module")
def poolFactory(controller, PoolFactory, admin):
    return admin.deploy(PoolFactory, controller)


@pytest.fixture(scope="module")
def pool(poolSetUp):
    return poolSetUp[0]


@pytest.fixture(scope="module")
def cappedPoolSetUp(
    pool_data,
    StakerVault,
    MockLpToken,
    admin,
    project,
    coin,
    controller,
    address_provider,
    topUpAction,
):
    return _pool(
        project,
        StakerVault,
        MockLpToken,
        admin,
        coin,
        pool_data,
        topUpAction,
        controller,
        address_provider,
        "MOCK-POOL",
        "MOK",
    )


@pytest.fixture(scope="module")
def cappedPool(cappedPoolSetUp):
    return cappedPoolSetUp[0]


def cappedLpToken(cappedPoolSetUp):
    return cappedPoolSetUp[1]


@pytest.fixture(scope="module")
def bkdToken(BkdToken, minter, admin):
    token = admin.deploy(BkdToken, "BKD", "BKD", minter)
    minter.setToken(token, {"from": admin})
    return token


@pytest.fixture(scope="module")
def minter(MockBKDMinter, controller, admin):
    annualInflationRateLp = 60_129_542 * 1e18 * 0.7
    annualInflationRateAmm = 60_129_542 * 1e18 * 0.1
    annualInflationRateKeeper = 60_129_542 * 1e18 * 0.2
    annualInflationDecayLp = 0.6 * 1e18
    annualInflationDecayKeeper = 0.4 * 1e18
    annualInflationDecayAmm = 0.4 * 1e18
    initialPeriodKeeperInflation = 500_000 * 1e18
    initialPeriodAmmInflation = 500_000 * 1e18
    non_inflation_distribution = 118_111_600 * 1e18
    minter = admin.deploy(
        MockBKDMinter,
        annualInflationRateLp,
        annualInflationRateKeeper,
        annualInflationRateAmm,
        annualInflationDecayLp,
        annualInflationDecayKeeper,
        annualInflationDecayAmm,
        initialPeriodKeeperInflation,
        initialPeriodAmmInflation,
        non_inflation_distribution,
        controller,
    )
    minter.startInflation({"from": admin})

    return minter


@pytest.fixture(scope="module")
def gas_bank(admin, GasBank, controller):
    return admin.deploy(GasBank, controller)


@pytest.fixture(scope="module")
def oracleProvider(admin, ChainlinkOracleProvider, role_manager):
    contract = admin.deploy(
        ChainlinkOracleProvider, role_manager, VendorAddresses.CHAINLINK_FEED_REGISTRY
    )
    contract.setStalePriceDelay(100 * 86400, {"from": admin})
    return contract


@pytest.fixture(scope="module")
def partially_initialized_address_provider(
    admin, role_manager, uninitialized_address_provider
):
    uninitialized_address_provider.initialize(role_manager, {"from": admin})
    return uninitialized_address_provider


@pytest.fixture(scope="module")
def address_provider(
    admin,
    controller,
    vaultReserve,
    gas_bank,
    oracleProvider,
    poolFactory,
    partially_initialized_address_provider,
    SwapperRouter
):
    partially_initialized_address_provider.initializeAddress(
        AddressProviderKeys.CONTROLLER.value, controller, {"from": admin}
    )
    partially_initialized_address_provider.initializeAddress(
        AddressProviderKeys.VAULT_RESERVE.value, vaultReserve, {"from": admin}
    )
    partially_initialized_address_provider.initializeAddress(
        AddressProviderKeys.GAS_BANK.value, gas_bank, {"from": admin}
    )
    partially_initialized_address_provider.initializeAddress(
        AddressProviderKeys.ORACLE_PROVIDER.value, oracleProvider, {"from": admin}
    )
    partially_initialized_address_provider.initializeAddress(
        AddressProviderKeys.POOL_FACTORY.value, poolFactory, {"from": admin}
    )
    swapper_router = admin.deploy(SwapperRouter, partially_initialized_address_provider)
    partially_initialized_address_provider.initializeAddress(
        AddressProviderKeys.SWAPPER_ROUTER.value, swapper_router, {"from": admin}
    )
    return partially_initialized_address_provider


@pytest.fixture(scope="module")
def uninitialized_address_provider(AddressProvider, admin, treasury):
    return admin.deploy(AddressProvider, treasury)


@pytest.fixture(scope="module")
def inflation_manager(
    MockInflationManager, admin, partially_initialized_address_provider
):
    return admin.deploy(MockInflationManager, partially_initialized_address_provider)


@pytest.fixture(scope="module")
def controller(
    Controller, admin, inflation_manager, partially_initialized_address_provider
):
    controller = admin.deploy(Controller, partially_initialized_address_provider)
    controller.setInflationManager(inflation_manager, {"from": admin})
    return controller


@pytest.fixture(scope="module")
def mock_price_oracle(admin, MockPriceOracle):
    return admin.deploy(MockPriceOracle)


@pytest.fixture(scope="module")
def topUpAction(
    TopUpActionLibrary, MockTopUpAction, controller, admin, isForked, aaveHandler, compoundHandler, MockTopUpActionFeeHandler, address_provider
):
    admin.deploy(TopUpActionLibrary)
    contract = admin.deploy(MockTopUpAction, controller)
    feeHandler = admin.deploy(MockTopUpActionFeeHandler, controller, contract, 0, 0)
    address_provider.addFeeHandler(feeHandler, {"from": admin})
    if isForked:
        contract.initialize(
            feeHandler,
            [AAVE_PROTOCOL, COMPOUND_PROTOCOL],
            [aaveHandler, compoundHandler],
            {"from": admin},
        )
    else:
        contract.initialize(feeHandler, [], [], {"from": admin})
    return contract


@pytest.fixture(scope="module")
def topUpKeeperHelper(TopUpKeeperHelper, admin, topUpAction):
    return admin.deploy(TopUpKeeperHelper, topUpAction)


@pytest.fixture(scope="module")
def mockFeeBurner(MockFeeBurner, admin, controller):
    return admin.deploy(MockFeeBurner, controller)


@pytest.fixture(scope="module")
def rewardHandler(RewardHandler, admin, controller):
    return admin.deploy(RewardHandler, controller)


@pytest.fixture(scope="module")
def stakerVault(poolSetUp):
    return poolSetUp[2]


@pytest.fixture(scope="module")
def cappedStakerVault(cappedPoolSetUp):
    return cappedPoolSetUp[2]


@pytest.fixture(scope="module")
def lpGauge(LpGauge, stakerVault, controller, admin, pool):
    gauge = admin.deploy(LpGauge, controller, stakerVault)
    stakerVault.initializeLpGauge(gauge, {"from": admin})
    return gauge


@pytest.fixture(scope="module")
def keeperGauge(KeeperGauge, controller, pool, admin):
    return admin.deploy(KeeperGauge, controller, pool)


@pytest.fixture(scope="module")
def ammGauge(AmmGauge, controller, mockAmmToken, admin):
    return admin.deploy(AmmGauge, controller, mockAmmToken)


@pytest.fixture
def mockAmmGauge(admin, MockAmmGauge, controller, mockAmmToken):
    return admin.deploy(MockAmmGauge, controller, mockAmmToken)


@pytest.fixture
def mockKeeperGauge(admin, MockKeeperGauge, controller, pool):
    return admin.deploy(MockKeeperGauge, controller, pool)


@pytest.fixture(scope="module")
def vault(
    admin,
    MockErc20Vault,
    MockEthVault,
    vaultReserve,
    pool,
    coin,
    controller,
    isForked,
    chain,
):
    debtLimit = 0
    targetAllocation = 0
    allocationBound = 0

    VaultContract = MockEthVault if coin == ZERO_ADDRESS else MockErc20Vault
    vault = admin.deploy(VaultContract, controller)
    vault.initialize(
        pool, debtLimit, targetAllocation, allocationBound, {"from": admin}
    )
    vault.preparePerformanceFee(scale("0.05"))
    chain.sleep(ADMIN_DELAY)
    vault.executePerformanceFee()

    # pool and vault set up
    if isForked:
        pool.prepareNewVault(vault, {"from": admin})
        chain.sleep(ADMIN_DELAY)
        pool.executeNewVault({"from": admin})
    else:
        pool.setVault(vault, {"from": admin})

    return vault


@pytest.fixture(scope="module")
def pool_with_vault(pool, vault):
    return pool


@pytest.fixture(scope="module")
def setUpStrategyForVault(strategy, admin, vault):
    vault.setStrategy(strategy, {"from": admin})
    vault.activateStrategy({"from": admin})
    strategy.setVault(vault, {"from": admin})


@pytest.fixture(scope="module")
def role_manager(admin, RoleManager, uninitialized_address_provider):
    return admin.deploy(RoleManager, uninitialized_address_provider)


@pytest.fixture(scope="module")
def vaultReserve(admin, VaultReserve, role_manager):
    return admin.deploy(VaultReserve, role_manager)


@pytest.fixture(scope="module")
def strategy(MockEthStrategy, MockErc20Strategy, coin, admin, role_manager):
    if coin == ZERO_ADDRESS:
        return admin.deploy(MockEthStrategy, role_manager)
    else:
        return admin.deploy(MockErc20Strategy, role_manager, coin)


@pytest.fixture(scope="module")
def math_funcs(admin, ScaledMathWrapper):
    return admin.deploy(ScaledMathWrapper)


@pytest.fixture(scope="module")
def topUpActionFeeHandler(MockTopUpActionFeeHandler, topUpAction):
    return MockTopUpActionFeeHandler.at(topUpAction.getFeeHandler())


@pytest.fixture(scope="module")
def mockAmmToken(MockAmmToken, admin):
    return admin.deploy(MockAmmToken, "MockAmm", "MockAmm")


@pytest.fixture(scope="module")
def mockStrategy(admin, MockErc20Strategy, MockEthStrategy, role_manager, coin):
    if coin == ZERO_ADDRESS:
        return admin.deploy(MockEthStrategy, role_manager)
    else:
        return admin.deploy(MockErc20Strategy, role_manager, coin)


@pytest.fixture(scope="module")
def mockLockingStrategy(
    admin, MockLockingErc20Strategy, MockLockingEthStrategy, coin, role_manager
):
    if coin == ZERO_ADDRESS:
        raise admin.deploy(MockLockingEthStrategy, role_manager)
    return admin.deploy(MockLockingErc20Strategy, role_manager, coin)


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def swapperRouter(SwapperRouter, address_provider):
    return SwapperRouter.at(address_provider.getAddress(AddressProviderKeys.SWAPPER_ROUTER.value))


def lpToken(poolSetUp):
    return poolSetUp[1]


@pytest.fixture(scope="module")
def mockTopUpHandler(MockTopUpHandler, admin):
    return admin.deploy(MockTopUpHandler)


@pytest.fixture(scope="module")
def bkdLocker(admin, BkdLocker, bkdToken, lpToken, role_manager):
    return admin.deploy(BkdLocker, lpToken, bkdToken, role_manager)


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def aaveHandler(AaveHandler, admin):
    return admin.deploy(
        AaveHandler, VendorAddresses.AAVE_LENDING_POOL, TokenAddresses.WETH
    )


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def ctoken_registry(admin, CTokenRegistry, isForked):
    if isForked:
        return admin.deploy(CTokenRegistry, VendorAddresses.COMPOUND_COMPTROLLER)


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def compoundHandler(CompoundHandler, ctoken_registry, admin, isForked):
    if isForked:
        return admin.deploy(
            CompoundHandler, VendorAddresses.COMPOUND_COMPTROLLER, ctoken_registry
        )


@pytest.fixture(scope="module")
def controllerProfiler(admin, controller, ControllerProfiler):
    return admin.deploy(ControllerProfiler, controller)


@pytest.fixture
def mockAction(admin, address_provider, MockAction):
    action = admin.deploy(MockAction)
    address_provider.addAction(action)
    return action


@pytest.fixture(scope="module")
def mockCurveToken(admin, MockCurveToken):
    return admin.deploy(MockCurveToken, 18)


@pytest.fixture(scope="module")
def mockCvxToken(admin, MockErc20):
    return admin.deploy(MockErc20, 18)


@pytest.fixture(scope="module")
def mockCvxWrapper(admin, MockErc20):
    return admin.deploy(MockErc20, 18)


@pytest.fixture(scope="module")
def mockBooster(admin, MockBooster, mockAmmToken, mockCvxWrapper, mockRewardStaking):
    booster = admin.deploy(MockBooster, mockAmmToken, mockCvxWrapper, mockRewardStaking)
    mockRewardStaking.setBooster(booster)
    return booster


@pytest.fixture(scope="module")
def mockRewardStaking(
    admin, MockRewardStaking, mockCvxWrapper, mockCurveToken, mockCvxToken
):
    return admin.deploy(MockRewardStaking, mockCvxWrapper, mockCurveToken, mockCvxToken)


@pytest.fixture(scope="module")
def ammConvexGauge(
    AmmConvexGauge,
    controller,
    mockAmmToken,
    mockCurveToken,
    mockCvxToken,
    mockBooster,
    admin,
):
    return admin.deploy(
        AmmConvexGauge,
        controller,
        mockAmmToken,
        0,
        mockCurveToken,
        mockCvxToken,
        mockBooster,
    )
