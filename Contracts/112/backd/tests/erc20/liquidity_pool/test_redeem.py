import pytest
import brownie

pytestmark = pytest.mark.usefixtures(
    "mintAlice", "approveAlice", "curveInitialLiquidity"
)


def test_redeem_for_underlying(alice, vault, lpToken, pool, coin, initialAmount):
    pool.setMinWithdrawalFee(0)
    pool.setMaxWithdrawalFee(0)
    assert pool.lpToken() == lpToken
    pool.deposit(initialAmount, {"from": alice})

    # dev: exchange rate is 1; pool amount == underlying amount
    assert coin.balanceOf(alice) == 0
    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(vault) == initialAmount
    assert lpToken.balanceOf(alice) == initialAmount
    assert lpToken.totalSupply() == initialAmount

    tx = pool.redeem(initialAmount, {"from": alice})
    assert tx.events["Redeem"][0]["redeemer"] == alice
    assert tx.events["Redeem"][0]["redeemAmount"] == initialAmount
    assert tx.events["Redeem"][0]["redeemTokens"] == initialAmount
    assert coin.balanceOf(alice) == initialAmount
    assert lpToken.balanceOf(alice) == 0
    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(vault) == 0
    assert lpToken.totalSupply() == 0


def test_redeem_fail_insufficient_balance(alice, lpToken, pool, initialAmount):
    pool.deposit(initialAmount, {"from": alice})
    assert lpToken.totalSupply() == initialAmount
    with brownie.reverts("insufficient balance"):
        pool.redeem(2 * initialAmount, {"from": alice})


def test_redeem_charge_no_withdrawal_fee(
    bob, admin, pool, coin, initialAmount, mintBob, approveBob
):
    # dev: set 1% withdrawal fee
    newFee = 0.01 * 1e18
    pool.setMaxWithdrawalFee(newFee, {"from": admin})
    pool.setMinWithdrawalFee(newFee, {"from": admin})
    pool.deposit(initialAmount, {"from": bob})
    pool.redeem(initialAmount, {"from": bob})
    coin.balanceOf(pool) == 0
    coin.balanceOf(bob) == initialAmount
    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(bob) == initialAmount


def test_redeem_charge_withdrawal_fee(
    alice, bob, vault, lpToken, admin, pool, coin, initialAmount, mintBob, approveBob
):
    newFee = 0.01 * 1e18
    pool.setMaxWithdrawalFee(newFee, {"from": admin})
    pool.setMinWithdrawalFee(newFee, {"from": admin})
    pool.setWithdrawalFeeDecreasePeriod(86400, {"from": admin})

    pool.deposit(initialAmount, {"from": alice})
    pool.deposit(initialAmount, {"from": bob})
    assert coin.balanceOf(vault) == initialAmount * 2

    pool.redeem(initialAmount, {"from": bob})
    assert coin.balanceOf(vault) == 1.01 * initialAmount
    assert coin.balanceOf(bob) == 0.99 * initialAmount
    assert coin.balanceOf(alice) == 0

    pool.redeem(initialAmount, {"from": alice})
    assert coin.balanceOf(vault) == 0
    assert coin.balanceOf(alice) == 1.01 * initialAmount
    assert lpToken.balanceOf(alice) == 0
    assert lpToken.balanceOf(bob) == 0
    assert lpToken.totalSupply() == 0


def test_redeem_withdrawal_fee_exchange_rate(
    alice, vault, initialAmount, decimals, lpToken, admin, pool, coin
):
    fee = 0.05 * 1e18
    pool.setMaxWithdrawalFee(fee, {"from": admin})
    pool.setMinWithdrawalFee(fee, {"from": admin})
    pool.setWithdrawalFeeDecreasePeriod(86400, {"from": admin})

    pool.deposit(initialAmount, {"from": alice})
    assert coin.balanceOf(vault) == initialAmount

    redeemAmount = 10 ** decimals
    pool.redeem(redeemAmount, {"from": alice})
    aliceUnderlying = coin.balanceOf(alice)

    assert aliceUnderlying == 0.95 * redeemAmount
    assert lpToken.balanceOf(alice) == initialAmount - redeemAmount
    assert coin.balanceOf(vault) == initialAmount - 0.95 * redeemAmount
    exchangeRate = (
        10 ** 18
        * (initialAmount - 0.95 * redeemAmount)
        / (initialAmount - redeemAmount)
    )
    assert pytest.approx(pool.exchangeRate.call()) == exchangeRate


def test_unstake_and_redeem_with_nothing_staked(alice, vault, lpToken, pool, coin, initialAmount, address_provider, admin, stakerVault):
    address_provider.addPool(pool, {"from": admin})
    pool.setMinWithdrawalFee(0)
    pool.setMaxWithdrawalFee(0)
    pool.deposit(initialAmount, {"from": alice})

    # dev: exchange rate is 1; pool amount == underlying amount
    assert coin.balanceOf(alice) == 0
    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(vault) == initialAmount
    assert lpToken.balanceOf(alice) == initialAmount
    assert lpToken.totalSupply() == initialAmount
    assert stakerVault.balanceOf(alice) == 0

    tx = pool.unstakeAndRedeem(initialAmount, 0, {"from": alice})
    assert tx.events["Redeem"][0]["redeemer"] == alice
    assert tx.events["Redeem"][0]["redeemAmount"] == initialAmount
    assert tx.events["Redeem"][0]["redeemTokens"] == initialAmount
    assert coin.balanceOf(alice) == initialAmount
    assert lpToken.balanceOf(alice) == 0
    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(vault) == 0
    assert lpToken.totalSupply() == 0
    assert stakerVault.balanceOf(alice) == 0


def test_unstake_and_redeem_with_some_staked(alice, vault, lpToken, pool, coin, initialAmount, address_provider, admin, stakerVault):
    address_provider.addPool(pool, {"from": admin})
    pool.setMinWithdrawalFee(0)
    pool.setMaxWithdrawalFee(0)
    pool.deposit(initialAmount, {"from": alice})
    lpToken.approve(stakerVault, initialAmount, {"from": alice})
    stakerVault.stake(initialAmount / 2, {"from": alice})

    # dev: exchange rate is 1; pool amount == underlying amount
    assert coin.balanceOf(alice) == 0
    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(vault) == initialAmount
    assert lpToken.balanceOf(alice) == initialAmount / 2
    assert lpToken.totalSupply() == initialAmount
    assert stakerVault.balanceOf(alice) == initialAmount / 2

    tx = pool.unstakeAndRedeem(initialAmount, 0, {"from": alice})
    assert tx.events["Redeem"][0]["redeemer"] == alice
    assert tx.events["Redeem"][0]["redeemAmount"] == initialAmount
    assert tx.events["Redeem"][0]["redeemTokens"] == initialAmount
    assert coin.balanceOf(alice) == initialAmount
    assert lpToken.balanceOf(alice) == 0
    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(vault) == 0
    assert lpToken.totalSupply() == 0
    assert stakerVault.balanceOf(alice) == 0


def test_unstake_and_redeem_with_all_staked(alice, vault, lpToken, pool, coin, initialAmount, address_provider, admin, stakerVault):
    address_provider.addPool(pool, {"from": admin})
    pool.setMinWithdrawalFee(0)
    pool.setMaxWithdrawalFee(0)
    pool.deposit(initialAmount, {"from": alice})
    lpToken.approve(stakerVault, initialAmount, {"from": alice})
    stakerVault.stake(initialAmount, {"from": alice})

    # dev: exchange rate is 1; pool amount == underlying amount
    assert coin.balanceOf(alice) == 0
    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(vault) == initialAmount
    assert lpToken.balanceOf(alice) == 0
    assert lpToken.totalSupply() == initialAmount
    assert stakerVault.balanceOf(alice) == initialAmount

    tx = pool.unstakeAndRedeem(initialAmount, 0, {"from": alice})
    assert tx.events["Redeem"][0]["redeemer"] == alice
    assert tx.events["Redeem"][0]["redeemAmount"] == initialAmount
    assert tx.events["Redeem"][0]["redeemTokens"] == initialAmount
    assert coin.balanceOf(alice) == initialAmount
    assert lpToken.balanceOf(alice) == 0
    assert coin.balanceOf(pool) == 0
    assert coin.balanceOf(vault) == 0
    assert lpToken.totalSupply() == 0
    assert stakerVault.balanceOf(alice) == 0
