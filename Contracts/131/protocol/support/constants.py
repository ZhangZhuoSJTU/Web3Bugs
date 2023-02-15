from dataclasses import dataclass
from enum import Enum

from support.convert import format_to_bytes

LATEST_ERC20_POOL_IMPLEMENTATION_NAME = "erc20-pool-v1"
LATEST_ETH_POOL_IMPLEMENTATION_NAME = "eth-pool-v1"
LATEST_ERC20_VAULT_IMPLEMENTATION_NAME = "erc20-vault-v1"
LATEST_ETH_VAULT_IMPLEMENTATION_NAME = "eth-vault-v1"
LATEST_STAKER_VAULT_IMPLEMENTATION_NAME = "staker-vault-v1"
LATEST_LP_TOKEN_IMPLEMENTATION_NAME = "lp-token-v1"

MAINNET_TREASURY_ADDRESS = "0x8Ca8f797506BBA85AD418dD2eb190Da561D37641"
KOVAN_TREASURY_ADDRESS = "0x7DC14F776129983183D62cc4DF4C8301CF79B47B"

MAINNET_DEPLOYER_ADDRESS = "0xd24F0164aEdbe5676536deb4867CD3d58b4f5405"
STRATEGY_VAULT_ADDRESS = "0x196BC79fEe5dad65Bdc0781955F17B184451Ad36"

ADMIN_DELAY = 3 * 86400


@dataclass
class Addresses:
    weth: str
    aave_lending_pool: str
    comptroller: str


MAINNET_ADDRESSES = Addresses(
    aave_lending_pool="0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
    comptroller="0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B",
    weth="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
)

ADDRESSES = {
    1: MAINNET_ADDRESSES,
    42: Addresses(
        weth="0xd0A1E359811322d97991E03f863a0C30C2cF029C",
        aave_lending_pool="0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",
        comptroller="0x5eAe89DC1C671724A672ff0630122ee834098657",
    ),
    1337: MAINNET_ADDRESSES,  # not used in development
}


class AddressProviderKeys(Enum):
    TREASURY = format_to_bytes("treasury", 32, output_hex=True)
    GAS_BANK = format_to_bytes("gasBank", 32, output_hex=True)
    VAULT_RESERVE = format_to_bytes("vaultReserve", 32, output_hex=True)
    ORACLE_PROVIDER = format_to_bytes("oracleProvider", 32, output_hex=True)
    POOL_FACTORY = format_to_bytes("poolFactory", 32, output_hex=True)
    CONTROLLER = format_to_bytes("controller", 32, output_hex=True)
    BKD_LOCKER = format_to_bytes("bkdLocker", 32, output_hex=True)
    ROLE_MANAGER = format_to_bytes("roleManager", 32, output_hex=True)
    SWAPPER_ROUTER = format_to_bytes("swapperRouter", 32, output_hex=True)


class Roles(Enum):
    GOVERNANCE = format_to_bytes("governance", 32, output_hex=True)
    MAINTENANCE = format_to_bytes("maintenance", 32, output_hex=True)
    ADDRESS_PROVIDER = format_to_bytes("address_provider", 32, output_hex=True)
    POOL_FACTORY = format_to_bytes("pool_factory", 32, output_hex=True)
    CONTROLLER = format_to_bytes("controller", 32, output_hex=True)
    GAUGE_ZAP = format_to_bytes("gauge_zap", 32, output_hex=True)
    INFLATION_MANAGER = format_to_bytes("inflation_manager", 32, output_hex=True)
