import brownie
import pytest
from decimal import Decimal
from support.utils import scale
from support.mainnet_contracts import TokenAddresses

SLIPPAGE_TOLERANCE = Decimal(0.94)
SWAP_AMOUNT = scale(300_000)


MOCK_COIN_A = "0x328DB824B016326A401d083B33D092293333A830"
MOCK_COIN_B = "0x823BA424B016326A401d083B3CC017892233A271"


@pytest.mark.mainnetFork
def test_revert_swap_invalid_token_pair(swapper3Crv):
    with brownie.reverts("Token pair not swappable"):
        swapper3Crv.swap(MOCK_COIN_A, MOCK_COIN_B, 1, 0)

    with brownie.reverts("Token pair not swappable"):
        swapper3Crv.swap(MOCK_COIN_A, TokenAddresses.DAI, 1, 0)

    with brownie.reverts("Token pair not swappable"):
        swapper3Crv.swap(TokenAddresses.USDC, MOCK_COIN_A, 1, 0)

    with brownie.reverts("Token pair not swappable"):
        swapper3Crv.swap(TokenAddresses.TRI_CRV, MOCK_COIN_A, 1, 0)


@pytest.mark.mainnetFork
def test_revert_swap_insufficient_amount(alice, swapper3Crv, triCrv, dai):
    amount = triCrv.balanceOf(alice)
    assert amount > SWAP_AMOUNT
    triCrv.approve(swapper3Crv, 2 ** 256 - 1, {"from": alice})

    with brownie.reverts("insufficient funds received"):
        swapper3Crv.swap(triCrv, dai, SWAP_AMOUNT, 10 * SWAP_AMOUNT, {"from": alice})


@pytest.mark.mainnetFork
def test_swap_3Crv_to_dai(alice, swapper3Crv, dai, triCrv):
    amount = triCrv.balanceOf(alice)
    assert amount > SWAP_AMOUNT
    triCrv.approve(swapper3Crv, 2 ** 256 - 1, {"from": alice})

    previous_balance = dai.balanceOf(alice)
    rate = swapper3Crv.getRate(triCrv, dai)
    minAmountOut = (SWAP_AMOUNT * rate * SLIPPAGE_TOLERANCE) / Decimal(10 ** 18)
    swapper3Crv.swap(triCrv, dai, SWAP_AMOUNT, minAmountOut, {"from": alice})
    assert dai.balanceOf(alice) > previous_balance


@pytest.mark.mainnetFork
def test_swap_3Crv_to_usdc(alice, swapper3Crv, triCrv, usdc):
    amount = triCrv.balanceOf(alice)
    assert amount > SWAP_AMOUNT
    triCrv.approve(swapper3Crv, 2 ** 256 - 1, {"from": alice})

    previous_balance = usdc.balanceOf(alice)
    rate = swapper3Crv.getRate(triCrv, usdc)
    minAmountOut = (SWAP_AMOUNT * rate * SLIPPAGE_TOLERANCE) / Decimal(10 ** 18)
    swapper3Crv.swap(triCrv, usdc, SWAP_AMOUNT, minAmountOut, {"from": alice})
    assert usdc.balanceOf(alice) > previous_balance


@pytest.mark.mainnetFork
def test_swap_3Crv_to_usdt(alice, swapper3Crv, usdt, triCrv):
    amount = triCrv.balanceOf(alice)
    assert amount > SWAP_AMOUNT
    triCrv.approve(swapper3Crv, 2 ** 256 - 1, {"from": alice})

    previous_balance = usdt.balanceOf(alice)
    rate = swapper3Crv.getRate(triCrv, usdt)
    minAmountOut = (SWAP_AMOUNT * rate * SLIPPAGE_TOLERANCE) / Decimal(10 ** 18)
    swapper3Crv.swap(triCrv, usdt, SWAP_AMOUNT, minAmountOut, {"from": alice})
    assert usdt.balanceOf(alice) > previous_balance


@pytest.mark.mainnetFork
def test_get_best_dex(swapper3Crv, dai, usdc):
    sushiSwap = swapper3Crv.SUSHISWAP()
    uniswap = swapper3Crv.UNISWAP()

    sushiOut = swapper3Crv.tokenAmountOut(dai, usdc, scale(1), sushiSwap)
    uniOut = swapper3Crv.tokenAmountOut(dai, usdc, scale(1), uniswap)
    bestDex = uniswap if uniOut >= sushiOut else sushiSwap
    assert swapper3Crv.getBestDex(dai, usdc, scale(1))[0] == bestDex
