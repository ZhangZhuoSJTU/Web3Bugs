from support.constants import (
    LATEST_ERC20_POOL_IMPLEMENTATION_NAME,
    LATEST_ERC20_VAULT_IMPLEMENTATION_NAME,
    LATEST_ETH_POOL_IMPLEMENTATION_NAME,
    LATEST_ETH_VAULT_IMPLEMENTATION_NAME,
    LATEST_LP_TOKEN_IMPLEMENTATION_NAME,
    LATEST_STAKER_VAULT_IMPLEMENTATION_NAME,
)
from support.utils import (
    as_singleton,
    make_tx_params,
    with_deployed,
    with_gas_usage,
    get_deployer,
)
from support.convert import format_to_bytes
from brownie import Erc20Pool, EthPool, LpToken, StakerVault  # type: ignore
from brownie import Erc20Vault, EthVault, PoolFactory, Controller  # type: ignore

DUMMY_ADDRESS = "0xbac78B32D54Eb93F6452FdC7f04633e98F0D8C97"


def _deploy_pool(Pool, name: str, controller, pool_factory, *args):
    tx_params = make_tx_params().copy()
    pool = get_deployer().deploy(Pool, controller, **tx_params)
    tx_params["from"] = get_deployer()
    pool.initialize(*args, tx_params)
    pool.pause(tx_params)
    name_b32 = format_to_bytes(name, 32)
    pool_factory.addPoolImplementation(name_b32, pool, tx_params)


def _deploy_vault(Vault, name: str, pool_factory, *args):
    tx_params = make_tx_params().copy()
    vault = get_deployer().deploy(Vault, *args, **tx_params)
    tx_params["from"] = get_deployer()
    name_b32 = format_to_bytes(name, 32)
    pool_factory.addVaultImplementation(name_b32, vault, tx_params)


@with_gas_usage
@as_singleton(Erc20Pool)
@with_deployed(PoolFactory)
@with_deployed(Controller)
def erc20_pool(controller, pool_factory):
    _deploy_pool(
        Erc20Pool,
        LATEST_ERC20_POOL_IMPLEMENTATION_NAME,
        controller,
        pool_factory,
        "cloneable-erc20",
        DUMMY_ADDRESS,
        DUMMY_ADDRESS
    )


@with_gas_usage
@as_singleton(EthPool)
@with_deployed(PoolFactory)
@with_deployed(Controller)
def eth_pool(controller, pool_factory):
    _deploy_pool(
        EthPool,
        LATEST_ETH_POOL_IMPLEMENTATION_NAME,
        controller,
        pool_factory,
        "cloneable-eth",
        DUMMY_ADDRESS
    )


@with_gas_usage
@as_singleton(Erc20Vault)
@with_deployed(PoolFactory)
@with_deployed(Controller)
def erc20_vault(controller, pool_factory):
    _deploy_vault(
        Erc20Vault,
        LATEST_ERC20_VAULT_IMPLEMENTATION_NAME,
        pool_factory,
        controller,
    )


@with_gas_usage
@as_singleton(EthVault)
@with_deployed(PoolFactory)
@with_deployed(Controller)
def eth_vault(controller, pool_factory):
    _deploy_vault(
        EthVault,
        LATEST_ETH_VAULT_IMPLEMENTATION_NAME,
        pool_factory,
        controller,
    )


@with_gas_usage
@as_singleton(LpToken)
@with_deployed(PoolFactory)
def lp_token(pool_factory):
    tx_params = make_tx_params().copy()
    lp_token = get_deployer().deploy(LpToken, **tx_params)
    pool_factory.addLpTokenImplementation(
        format_to_bytes(LATEST_LP_TOKEN_IMPLEMENTATION_NAME, 32),
        lp_token,
        {"from": get_deployer(), **tx_params},
    )


@with_gas_usage
@as_singleton(StakerVault)
@with_deployed(PoolFactory)
@with_deployed(LpToken)
@with_deployed(Controller)
def staker_vault(controller, lp_token, pool_factory):
    tx_params = make_tx_params().copy()
    staker_vault = get_deployer().deploy(StakerVault, controller, **tx_params)
    tx_params["from"] = get_deployer()
    staker_vault.initialize(lp_token, tx_params)
    staker_vault.pause(tx_params)
    pool_factory.addStakerVaultImplementation(
        format_to_bytes(LATEST_STAKER_VAULT_IMPLEMENTATION_NAME, 32),
        staker_vault,
        tx_params,
    )
