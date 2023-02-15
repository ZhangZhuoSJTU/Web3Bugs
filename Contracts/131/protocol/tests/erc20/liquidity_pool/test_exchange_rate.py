import pytest
import brownie


MOCK_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"

pytestmark = pytest.mark.usefixtures("mintAlice", "approveAlice")


def test_exchange_rate_unchanged(alice, decimals, pool):
    pool.deposit(10 ** decimals, {"from": alice})
    assert pool.exchangeRate() == 1e18


@pytest.mark.usefixtures("setUpStrategyForVault")
def test_redeem_plus_interest_minus_withdrawal_fee(
    alice, bob, admin, strategy, vault, pool, coin, lpToken, initialAmount
):
    pool.setMaxWithdrawalFee(0.05 * 1e18, {"from": admin})
    pool.setMinWithdrawalFee(0.05 * 1e18, {"from": admin})
    pool.setWithdrawalFeeDecreasePeriod(86400, {"from": admin})

    pool.deposit(initialAmount, {"from": alice})

    # dev: mock yield
    profit = initialAmount * 0.1
    coin.mint_for_testing(strategy, profit, {"from:": admin})

    # harvest profits
    vault.harvest({"from": admin})

    supply = lpToken.totalSupply()

    coin.mint_for_testing(bob, initialAmount)
    coin.approve(pool, initialAmount, {"from": bob})
    pool.deposit(initialAmount, {"from": bob})

    pool.redeem(initialAmount, {"from": alice})
    # dev: performance fee on profits + withdrawal fee on total

    taxedProfit = 0.95 * profit

    expectedUnderlying = (taxedProfit + initialAmount) * 0.95
    assert pytest.approx(coin.balanceOf(alice)) == expectedUnderlying
