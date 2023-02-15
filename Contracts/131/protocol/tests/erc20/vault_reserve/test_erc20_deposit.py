import brownie
from brownie import MockErc20

MOCK_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"


def test_reserve_deposit(vaultReserve, vault, coin, admin, decimals):
    coin.mint_for_testing(vault, 10**decimals, {"from": admin})
    vault.depositToReserve(coin, 10**decimals, {"from": admin})
    assert coin.balanceOf(vaultReserve) == 10**decimals
    assert vaultReserve.getBalance(vault, coin) == 10**decimals


def test_reserve_deposit_multiple_coins(vaultReserve, admin, vault, coin, decimals):
    mockCoin = admin.deploy(MockErc20, 6)
    for _coin, _decimals in zip([coin, mockCoin], [decimals, 6]):
        _coin.mint_for_testing(vault, 10**_decimals, {"from": admin})
        vault.depositToReserve(_coin, 10**_decimals, {"from": admin})
        assert _coin.balanceOf(vaultReserve) == 10**_decimals
        assert vaultReserve.getBalance(vault, _coin) == 10**_decimals
