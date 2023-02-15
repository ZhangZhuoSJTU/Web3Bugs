from brownie.test.managers.runner import RevertContextManager as reverts
from support.utils import scale


def test_deposit_insufficient_funds(isForked, coin, charlie, pool, decimals):
    assert coin.balanceOf(charlie) == 0
    assert coin.allowance(charlie, pool) == 0
    assert pool.getUnderlying() == coin
    coin.approve(pool, 10**decimals, {"from": charlie})
    if isForked:
        with reverts():
            pool.deposit(10**decimals, {"from": charlie})
    else:
        with reverts("ERC20: transfer amount exceeds balance"):
            pool.deposit(10**decimals, {"from": charlie})


def test_deposit_insufficient_allowance(isForked, coin, alice, pool, decimals):
    assert coin.allowance(alice, pool) == 0
    if isForked:
        with reverts():
            pool.deposit(10**decimals, {"from": alice})
    else:
        with reverts("ERC20: insufficient allowance"):
            pool.deposit(10**decimals, {"from": alice})


def test_deposit(coin, alice, pool, lpToken, decimals):
    coin.mint_for_testing(alice, 10**decimals)
    coin.approve(pool, 10**decimals, {"from": alice})
    tx = pool.deposit(10**decimals, {"from": alice})
    assert lpToken.balanceOf(alice) == 10**decimals
    assert tx.events["Deposit"][0]["minter"] == alice
    assert tx.events["Deposit"][0]["depositAmount"] == 10**decimals
    assert tx.events["Deposit"][0]["mintedLpTokens"] == 10**decimals


def test_multiple_deposits(coin, alice, bob, charlie, pool, lpToken, decimals):
    coin.mint_for_testing(alice, 10**decimals)
    coin.mint_for_testing(bob, 10**decimals)
    coin.mint_for_testing(charlie, 10**decimals)
    coin.approve(pool, 10**decimals, {"from": alice})
    coin.approve(pool, 10**decimals, {"from": bob})
    coin.approve(pool, 10**decimals, {"from": charlie})
    pool.deposit(10**decimals, {"from": alice})
    pool.deposit(10**decimals, {"from": bob})
    pool.deposit(10**decimals, {"from": charlie})
    assert lpToken.balanceOf(alice) == 10**decimals
    assert lpToken.balanceOf(bob) == 10**decimals
    assert lpToken.balanceOf(charlie) == 10**decimals


def test_mint_for_diff_account(alice, bob, lpToken, pool, coin, decimals):
    coin.mint_for_testing(alice, 10**decimals)
    coin.approve(pool, 10**decimals, {"from": alice})
    tx = pool.depositFor(bob, 10**decimals, {"from": alice})
    assert tx.events["DepositFor"][0]["minter"] == alice
    assert tx.events["DepositFor"][0]["mintee"] == bob
    assert tx.events["DepositFor"][0]["depositAmount"] == 10**decimals
    assert tx.events["DepositFor"][0]["mintedLpTokens"] == 10**decimals
    assert lpToken.balanceOf(bob) == 10**decimals
    assert lpToken.balanceOf(alice) == 0
    assert coin.balanceOf(alice) == 0


def test_deposit_and_stake(
    coin, alice, pool, lpToken, decimals, stakerVault, address_provider, admin
):
    address_provider.addPool(pool, {"from": admin})
    coin.mint_for_testing(alice, scale(10, decimals))
    coin.approve(pool, scale(10, decimals), {"from": alice})
    tx = pool.depositAndStake(scale(10, decimals), 0, {"from": alice})
    assert lpToken.balanceOf(alice) == 0
    assert stakerVault.balanceOf(alice) == scale(10, decimals)
    assert tx.events["Deposit"][0]["minter"] == alice
    assert tx.events["Deposit"][0]["depositAmount"] == scale(10, decimals)
    assert tx.events["Deposit"][0]["mintedLpTokens"] == scale(10, decimals)


def test_deposit_different_exchange_rate(
    coin, alice, pool, lpToken, decimals, address_provider, admin
):
    address_provider.addPool(pool, {"from": admin})
    coin.mint_for_testing(alice, scale(30, decimals))
    coin.approve(pool, scale(30, decimals), {"from": alice})
    coin.transfer(pool, scale(10, decimals), {"from": alice})
    pool.deposit(scale(10, decimals), 0, {"from": alice})
    tx = pool.deposit(scale(10, decimals), 0, {"from": alice})
    assert tx.return_value == scale(5, decimals)
    assert lpToken.balanceOf(alice) == scale(15, decimals)
    assert tx.events["Deposit"][0]["minter"] == alice
    assert tx.events["Deposit"][0]["depositAmount"] == scale(10, decimals)
    assert tx.events["Deposit"][0]["mintedLpTokens"] == scale(5, decimals)
