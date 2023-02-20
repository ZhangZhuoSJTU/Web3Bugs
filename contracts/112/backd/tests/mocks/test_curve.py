import brownie
import pytest

# test mock curve stable swap contract
MINT_AMOUNT = 10000


def test_curve_add_liquidity(curveSetUp, curveSwap, curveInitialLiquidity, initialAmounts, curveCoins, alice):
    oldBalances = []
    for coin in curveCoins:
        oldBalances.append(coin.balanceOf(curveSwap))

    curveSwap.add_liquidity(initialAmounts, 0, {"from": alice})

    for i, (coin, amount) in enumerate(zip(curveCoins, initialAmounts)):
        assert oldBalances[i] + amount == coin.balanceOf(curveSwap)


def test_curve_exchange(curveSetUp, curveSwap, curveInitialLiquidity, initialAmounts, curveCoins, alice):
    curveSwap.add_liquidity(initialAmounts, 0, {"from": alice})
    curveCoins[0].mint_for_testing(alice, 10 ** 18)
    balances = [coin.balanceOf(alice) for coin in curveCoins]
    curveCoins[0].approve(curveSwap, 10 ** 18, {"from": alice})
    curveSwap.exchange(0, 1, 10 ** 18, (10 ** 6) * 0.99, {"from": alice})  # swap 1 DAI for USDC
    assert curveCoins[0].balanceOf(alice) < balances[0]
    assert curveCoins[1].balanceOf(alice) > balances[1]


def test_curve_remove_liquidity(curveSetUp, curveSwap, curveLpToken, curveInitialLiquidity, initialAmounts, curveCoins, alice):
    curveSwap.add_liquidity(initialAmounts, 0, {"from": alice})
    tokens = curveLpToken.balanceOf(alice)
    curveSwap.remove_liquidity(tokens, [0, 0, 0], {"from": alice})
    assert curveLpToken.balanceOf(alice) == 0
    for coin, amount in zip(curveCoins, initialAmounts):
        assert coin.balanceOf(alice) == amount


@pytest.mark.parametrize("i", [0, 1, 2])
def test_curve_remove_one_coin(curveSetUp, curveSwap, curveInitialLiquidity, initialAmounts, curveCoins, alice, i):
    curveSwap.add_liquidity(initialAmounts, 0, {"from": alice})
    balances = [coin.balanceOf(alice) for coin in curveCoins]
    curveSwap.remove_liquidity_one_coin(10 ** 18, i, 0, {"from": alice})  # remove 1 LP token worth of coin i
    assert curveCoins[i].balanceOf(alice) > balances[i]
    for j in range(3):
        if j != i:
            assert curveCoins[j].balanceOf(alice) == balances[j]
