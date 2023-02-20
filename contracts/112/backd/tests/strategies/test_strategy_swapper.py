
import pytest
from support.utils import scale
from support.mainnet_contracts import VendorAddresses
from brownie import ZERO_ADDRESS, reverts


@pytest.fixture
@pytest.mark.mainnetFork
def mockStrategySwapper(MockStrategySwapper, address_provider, admin):
    return admin.deploy(MockStrategySwapper, address_provider, scale("0.97"))


@pytest.mark.mainnetFork
def test_swap_all_weth_for_token(strategySwapper, alice, crv, weth, bob):
    crvBefore = crv.balanceOf(alice)
    weth.transfer(bob, weth.balanceOf(alice) - scale(1), {"from": alice})
    wethBefore = weth.balanceOf(alice)
    assert wethBefore > 0
    weth.approve(strategySwapper, wethBefore, {"from": alice})
    strategySwapper.swapAllWethForToken(crv, {"from": alice})
    assert weth.balanceOf(alice) == 0
    assert crv.balanceOf(alice) > crvBefore


@pytest.mark.mainnetFork
def test_swap_for_weth(strategySwapper, alice, crv, weth):
    wethBefore = weth.balanceOf(alice)
    crvBefore = crv.balanceOf(alice)
    crv.approve(strategySwapper, scale(100), {"from": alice})
    strategySwapper.swapForWeth(crv, scale(100), {"from": alice})
    assert weth.balanceOf(alice) > wethBefore
    assert crv.balanceOf(alice) == crvBefore - scale(100)


@pytest.mark.mainnetFork
def test_amount_out(strategySwapper, alice, crv, weth, cvx, bob):
    cvxBefore = cvx.balanceOf(alice)
    weth.transfer(bob, weth.balanceOf(alice), {"from": alice})
    cvxExpected = strategySwapper.amountOut(crv, cvx, scale(2))
    assert cvxExpected > 0
    crv.approve(strategySwapper, scale(2), {"from": alice})
    strategySwapper.swapForWeth(crv, scale(2), {"from": alice})
    wethBalance = weth.balanceOf(alice)
    weth.approve(strategySwapper, wethBalance, {"from": alice})
    strategySwapper.swapAllWethForToken(cvx, {"from": alice})
    cvxAfter = cvx.balanceOf(alice)
    cvxGained = cvxAfter - cvxBefore
    assert cvxGained == cvxExpected


@pytest.mark.mainnetFork
def test_set_curve_pool(strategySwapper, alice, crv, admin):
    assert strategySwapper.curvePools(crv) == ZERO_ADDRESS
    with reverts("unauthorized access"):
        strategySwapper.setCurvePool(crv, VendorAddresses.CURVE_CRV_ETH_POOL, {"from": alice})
    tx = strategySwapper.setCurvePool(crv, VendorAddresses.CURVE_CRV_ETH_POOL, {"from": admin})
    assert tx.events["SetCurvePool"][0]["token"] == crv
    assert tx.events["SetCurvePool"][0]["curvePool"] == VendorAddresses.CURVE_CRV_ETH_POOL
    assert strategySwapper.curvePools(crv) == VendorAddresses.CURVE_CRV_ETH_POOL
    tx = strategySwapper.setCurvePool(crv, ZERO_ADDRESS, {"from": admin})
    assert tx.events["SetCurvePool"][0]["token"] == crv
    assert tx.events["SetCurvePool"][0]["curvePool"] == ZERO_ADDRESS
    assert strategySwapper.curvePools(crv) == ZERO_ADDRESS


@pytest.mark.mainnetFork
def test_swap_all_weth_for_token_via_curve_pool(mockStrategySwapper, alice, crv, weth, admin, bob):
    mockStrategySwapper.overrideSlippageTolerance(scale("0.2"), {"from": admin})
    mockStrategySwapper.setCurvePool(crv, VendorAddresses.CURVE_CRV_ETH_POOL, {"from": admin})
    crvBefore = crv.balanceOf(alice)
    weth.transfer(bob, weth.balanceOf(alice) - scale(2), {"from": alice})
    wethBefore = weth.balanceOf(alice)
    assert wethBefore > 0
    weth.approve(mockStrategySwapper, wethBefore, {"from": alice})
    mockStrategySwapper.swapAllWethForToken(crv, {"from": alice})
    assert weth.balanceOf(alice) == 0
    assert crv.balanceOf(alice) > crvBefore


@pytest.mark.mainnetFork
def test_swap_for_weth_via_curve_pool(strategySwapper, alice, crv, weth, admin):
    strategySwapper.setCurvePool(crv, VendorAddresses.CURVE_CRV_ETH_POOL, {"from": admin})
    wethBefore = weth.balanceOf(alice)
    crvBefore = crv.balanceOf(alice)
    crv.approve(strategySwapper, scale(100), {"from": alice})
    strategySwapper.swapForWeth(crv, scale(100), {"from": alice})
    assert weth.balanceOf(alice) > wethBefore
    assert crv.balanceOf(alice) == crvBefore - scale(100)


@pytest.mark.mainnetFork
def test_amount_out_via_curve_pool(mockStrategySwapper, alice, crv, weth, cvx, bob, admin):
    mockStrategySwapper.overrideSlippageTolerance(scale("0.2"), {"from": admin})
    mockStrategySwapper.setCurvePool(crv, VendorAddresses.CURVE_CRV_ETH_POOL, {"from": admin})
    mockStrategySwapper.setCurvePool(cvx, VendorAddresses.CURVE_CVX_ETH_POOL, {"from": admin})
    cvxBefore = cvx.balanceOf(alice)
    weth.transfer(bob, weth.balanceOf(alice), {"from": alice})
    cvxExpected = mockStrategySwapper.amountOut(crv, cvx, scale(2))
    assert cvxExpected > 0
    crv.approve(mockStrategySwapper, scale(2), {"from": alice})
    mockStrategySwapper.swapForWeth(crv, scale(2), {"from": alice})
    wethBalance = weth.balanceOf(alice)
    weth.approve(mockStrategySwapper, wethBalance, {"from": alice})
    mockStrategySwapper.swapAllWethForToken(cvx, {"from": alice})
    cvxAfter = cvx.balanceOf(alice)
    cvxGained = cvxAfter - cvxBefore
    assert cvxGained == cvxExpected


@pytest.mark.mainnetFork
def test_amount_out_for_weth_in(strategySwapper, alice, crv, weth, bob):
    crvBefore = crv.balanceOf(alice)
    weth.transfer(bob, weth.balanceOf(alice) - scale(2), {"from": alice})
    wethBefore = weth.balanceOf(alice)
    assert wethBefore > 0
    crvExpected = strategySwapper.amountOut(weth, crv, wethBefore)
    weth.approve(strategySwapper, wethBefore, {"from": alice})
    strategySwapper.swapAllWethForToken(crv, {"from": alice})
    crvGained = crv.balanceOf(alice) - crvBefore
    assert crvGained == crvExpected


@pytest.mark.mainnetFork
def test_amount_out_for_token_in(strategySwapper, alice, crv, weth):
    wethBefore = weth.balanceOf(alice)
    wethExpected = strategySwapper.amountOut(crv, weth, scale(100))
    crv.approve(strategySwapper, scale(100), {"from": alice})
    strategySwapper.swapForWeth(crv, scale(100), {"from": alice})
    wethGained = weth.balanceOf(alice) - wethBefore
    assert wethGained == wethExpected


@pytest.mark.mainnetFork
def test_update_slippage_tolerance(strategySwapper, alice, admin):
    assert strategySwapper.slippageTolerance() == scale("0.97")
    with reverts("unauthorized access"):
        strategySwapper.setSlippageTolerance(scale("0.95"), {"from": alice})
    tx = strategySwapper.setSlippageTolerance(scale("0.95"), {"from": admin})
    assert tx.events["SetSlippageTolerance"][0]["value"] == scale("0.95")
    assert strategySwapper.slippageTolerance() == scale("0.95")


@pytest.mark.mainnetFork
def test_weth_swap_reverts_with_slippage(mockStrategySwapper, alice, weth, crv, admin):
    weth.approve(mockStrategySwapper, weth.balanceOf(alice), {"from": alice})
    mockStrategySwapper.overrideSlippageTolerance(scale("1.4"), {"from": admin})
    with reverts("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"):
        mockStrategySwapper.swapAllWethForToken(crv, {"from": alice})


@pytest.mark.mainnetFork
def test_token_swap_reverts_with_slippage(mockStrategySwapper, alice, crv, admin):
    crv.approve(mockStrategySwapper, crv.balanceOf(alice), {"from": alice})
    mockStrategySwapper.overrideSlippageTolerance(scale("1.4"), {"from": admin})
    with reverts("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"):
        mockStrategySwapper.swapForWeth(crv, scale(100), {"from": alice})


@pytest.mark.mainnetFork
def test_set_swap_via_uniswap(strategySwapper, alice, admin, crv):
    assert strategySwapper.swapViaUniswap(crv) == False
    with reverts("unauthorized access"):
        strategySwapper.setSwapViaUniswap(crv, True, {"from": alice})
    tx = strategySwapper.setSwapViaUniswap(crv, True, {"from": admin})
    assert tx.events["SetSwapViaUniswap"][0]["token"] == crv
    assert tx.events["SetSwapViaUniswap"][0]["swapViaUniswap"] == True
    assert strategySwapper.swapViaUniswap(crv) == True


@pytest.mark.mainnetFork
def test_swap_for_weth_via_uniswap(strategySwapper, alice, crv, weth, admin):
    strategySwapper.setSwapViaUniswap(crv, True, {"from": admin})
    wethBefore = weth.balanceOf(alice)
    crvBefore = crv.balanceOf(alice)
    crv.approve(strategySwapper, scale(100), {"from": alice})
    strategySwapper.swapForWeth(crv, scale(100), {"from": alice})
    assert weth.balanceOf(alice) > wethBefore
    assert crv.balanceOf(alice) == crvBefore - scale(100)


@pytest.mark.mainnetFork
def test_swap_all_weth_for_token_with_decimal_scale(strategySwapper, alice, usdc, weth, bob):
    crvBefore = usdc.balanceOf(alice)
    weth.transfer(bob, weth.balanceOf(alice) - scale(1), {"from": alice})
    wethBefore = weth.balanceOf(alice)
    assert wethBefore > 0
    weth.approve(strategySwapper, wethBefore, {"from": alice})
    strategySwapper.swapAllWethForToken(usdc, {"from": alice})
    assert weth.balanceOf(alice) == 0
    assert usdc.balanceOf(alice) > crvBefore


@pytest.mark.mainnetFork
def test_swap_for_weth_with_decimal_scale(strategySwapper, alice, usdc, weth):
    wethBefore = weth.balanceOf(alice)
    crvBefore = usdc.balanceOf(alice)
    usdc.approve(strategySwapper, scale(1000, 6), {"from": alice})
    strategySwapper.swapForWeth(usdc, scale(1000, 6), {"from": alice})
    assert weth.balanceOf(alice) > wethBefore
    assert usdc.balanceOf(alice) == crvBefore - scale(1000, 6)


@pytest.mark.mainnetFork
def test_amount_out_with_decimal_scale(strategySwapper, alice, usdc, weth, cvx, bob):
    cvxBefore = cvx.balanceOf(alice)
    weth.transfer(bob, weth.balanceOf(alice), {"from": alice})
    cvxExpected = strategySwapper.amountOut(usdc, cvx, scale(1000, 6))
    assert cvxExpected > 0
    usdc.approve(strategySwapper, scale(1000, 6), {"from": alice})
    strategySwapper.swapForWeth(usdc, scale(1000, 6), {"from": alice})
    wethBalance = weth.balanceOf(alice)
    weth.approve(strategySwapper, wethBalance, {"from": alice})
    strategySwapper.swapAllWethForToken(cvx, {"from": alice})
    cvxAfter = cvx.balanceOf(alice)
    cvxGained = cvxAfter - cvxBefore
    assert cvxGained == cvxExpected


@pytest.mark.mainnetFork
def test_weth_swap_reverts_with_slippage_with_decimal_scale(mockStrategySwapper, alice, weth, usdc, admin):
    weth.approve(mockStrategySwapper, weth.balanceOf(alice), {"from": alice})
    mockStrategySwapper.overrideSlippageTolerance(scale("1.4"), {"from": admin})
    with reverts("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"):
        mockStrategySwapper.swapAllWethForToken(usdc, {"from": alice})


@pytest.mark.mainnetFork
def test_token_swap_reverts_with_slippage_with_decimal_scale(mockStrategySwapper, alice, admin, usdc):
    usdc.approve(mockStrategySwapper, usdc.balanceOf(alice), {"from": alice})
    mockStrategySwapper.overrideSlippageTolerance(scale("1.4"), {"from": admin})
    with reverts("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"):
        mockStrategySwapper.swapForWeth(usdc, scale(1000, 6), {"from": alice})
