import pytest
import brownie

from brownie import ZERO_ADDRESS
from support.convert import format_to_bytes

NON_ZERO_ADDRESS = "0x8c3C6732F1544fc16e6880F9f417bd819138E292"
MOCK_CONTROLLER = "0x3c2C6732F1525fc16e6F80F9f417bd71913C3292"


@pytest.fixture
def newErc20Coin(MockErc20, admin):
    return admin.deploy(MockErc20, 18)


@pytest.fixture
def erc20PoolImpl(MockErc20Pool, admin, controller):
    return admin.deploy(MockErc20Pool, controller)


@pytest.fixture
def ethPoolImpl(MockEthPool, admin, controller):
    return admin.deploy(MockEthPool, controller)


@pytest.fixture
def lpTokenImpl(LpToken, admin):
    return admin.deploy(LpToken)


@pytest.fixture
def erc20VaultImpl(Erc20Vault, controller, admin, address_provider):
    return admin.deploy(Erc20Vault, controller)


@pytest.fixture
def ethVaultImpl(EthVault, controller, admin, address_provider):
    return admin.deploy(EthVault, controller)


@pytest.fixture
def stakerVaultImpl(StakerVault, admin, controller):
    return admin.deploy(StakerVault, controller)


ERC20_POOL_IMPL_NAME = format_to_bytes("erc20-pool", 32)
ETH_POOL_IMPL_NAME = format_to_bytes("eth-pool", 32)
ERC20_VAULT_IMPL_NAME = format_to_bytes("erc20-vault", 32)
ETH_VAULT_IMPL_NAME = format_to_bytes("eth-vault", 32)
LP_TOKEN_IMPL_NAME = format_to_bytes("lp-token", 32)
STAKER_VAULT_IMPL_NAME = format_to_bytes("staker-vault", 32)

POOL_KEY = format_to_bytes("pool", 32)
LP_TOKEN_KEY = format_to_bytes("lp_token", 32)
STAKER_VAULT_KEY = format_to_bytes("staker_vault", 32)
VAULT_KEY = format_to_bytes("vault", 32)


@pytest.fixture
def setUpFactory(
    poolFactory,
    erc20PoolImpl,
    erc20VaultImpl,
    ethVaultImpl,
    ethPoolImpl,
    lpTokenImpl,
    stakerVaultImpl,
    coin
):
    poolFactory.addPoolImplementation(ERC20_POOL_IMPL_NAME, erc20PoolImpl)
    poolFactory.addPoolImplementation(ETH_POOL_IMPL_NAME, ethPoolImpl)
    poolFactory.addLpTokenImplementation(LP_TOKEN_IMPL_NAME, lpTokenImpl)
    poolFactory.addVaultImplementation(ERC20_VAULT_IMPL_NAME, erc20VaultImpl)
    poolFactory.addVaultImplementation(ETH_VAULT_IMPL_NAME, ethVaultImpl)
    poolFactory.addStakerVaultImplementation(STAKER_VAULT_IMPL_NAME, stakerVaultImpl)

    # initialize pools -- this is so that the underlying is set and that ETH pool implementations can not be deployed with ERC20 coins and vice versa.
    erc20PoolImpl.initialize("", coin, ZERO_ADDRESS)
    ethPoolImpl.initialize("", ZERO_ADDRESS)
    stakerVaultImpl.initialize(lpTokenImpl)
    erc20VaultImpl.initialize(erc20PoolImpl, 0, 0, 0)
    ethVaultImpl.initialize(ethPoolImpl, 0, 0, 0)


def test_add_pool_implementation(poolFactory, erc20PoolImpl):
    poolFactory.addPoolImplementation(ERC20_POOL_IMPL_NAME, erc20PoolImpl)
    assert poolFactory.implementations(POOL_KEY, ERC20_POOL_IMPL_NAME) == erc20PoolImpl


def test_add_existing_pool_implementation_returns_false(poolFactory, erc20PoolImpl):
    tx = poolFactory.addPoolImplementation(ERC20_POOL_IMPL_NAME, erc20PoolImpl)
    assert tx.return_value
    tx = poolFactory.addPoolImplementation(ERC20_POOL_IMPL_NAME, erc20PoolImpl)
    assert not tx.return_value


def test_add_lp_token_implementation(poolFactory, lpTokenImpl):
    poolFactory.addLpTokenImplementation(LP_TOKEN_IMPL_NAME, lpTokenImpl)
    assert poolFactory.implementations(LP_TOKEN_KEY, LP_TOKEN_IMPL_NAME) == lpTokenImpl


def test_add_existing_lp_token_implementation_returns_false(poolFactory, lpTokenImpl):
    tx = poolFactory.addLpTokenImplementation(LP_TOKEN_IMPL_NAME, lpTokenImpl)
    assert tx.return_value
    tx = poolFactory.addLpTokenImplementation(LP_TOKEN_IMPL_NAME, lpTokenImpl)
    assert not tx.return_value


def _create_deploy_args(pool_name, underlying, pool_impl=None):
    is_eth = underlying == ZERO_ADDRESS
    if pool_impl is None:
        pool_impl = ETH_POOL_IMPL_NAME if is_eth else ERC20_POOL_IMPL_NAME

    return [
        pool_name,  # name
        underlying,  # underlying
        ["New LP Token", "NEW", 18],  # lp token args (name, symbol, decimal)
        [0, 0, 0],  # vault args (debtLimit, targetAllocation, bound)
        [
            pool_impl,
            ETH_VAULT_IMPL_NAME if is_eth else ERC20_VAULT_IMPL_NAME,
            LP_TOKEN_IMPL_NAME,
            STAKER_VAULT_IMPL_NAME,
        ],  # implementations (pool, vault, lp token, staker vault)
    ]


@pytest.mark.usefixtures("setUpFactory")
def test_deploy_new_erc20_pool(
    admin, MockErc20Pool, poolFactory, newErc20Coin, LpToken
):
    args = _create_deploy_args("new Erc20Pool", newErc20Coin)

    tx = poolFactory.deployPool(*args, {"from": admin})
    (
        poolAddress,
        vaultAddress,
        lpTokenAddress,
        stakerVaultAddress,
    ) = tx.return_value
    assert tx.events["NewPool"]["pool"] == poolAddress
    assert tx.events["NewPool"]["vault"] == vaultAddress
    assert tx.events["NewPool"]["lpToken"] == lpTokenAddress
    assert tx.events["NewPool"]["stakerVault"] == stakerVaultAddress
    pool = MockErc20Pool.at(poolAddress)
    assert pool.lpToken() == lpTokenAddress
    assert pool.getUnderlying() == newErc20Coin
    token = LpToken.at(lpTokenAddress)
    assert token.minter() == pool
    assert pool.controller() == poolFactory.controller()


@pytest.mark.usefixtures("setUpFactory")
def test_deploy_new_eth_pool(admin, poolFactory, MockEthPool, LpToken):
    args = _create_deploy_args("new EthPool", ZERO_ADDRESS)
    tx = poolFactory.deployPool(*args, {"from": admin})
    (
        poolAddress,
        vaultAddress,
        lpTokenAddress,
        stakerVaultAddress,
    ) = tx.return_value
    assert tx.events["NewPool"]["pool"] == poolAddress
    assert tx.events["NewPool"]["vault"] == vaultAddress
    assert tx.events["NewPool"]["lpToken"] == lpTokenAddress
    assert tx.events["NewPool"]["stakerVault"] == stakerVaultAddress
    pool = MockEthPool.at(poolAddress)
    assert pool.lpToken() == lpTokenAddress
    assert pool.getUnderlying() == ZERO_ADDRESS
    token = LpToken.at(lpTokenAddress)
    assert token.minter() == pool
    assert pool.controller() == poolFactory.controller()


@pytest.mark.usefixtures("setUpFactory")
def test_deploy_new_eth_pool_reverts(admin, poolFactory):
    with brownie.reverts("invalid pool implementation for given coin"):
        args = _create_deploy_args(
            "new EthPool", ZERO_ADDRESS, pool_impl=ERC20_POOL_IMPL_NAME
        )
        poolFactory.deployPool(*args, {"from": admin})
