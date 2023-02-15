import pytest
from brownie import ZERO_ADDRESS, reverts
from support.mainnet_contracts import VendorAddresses

from support.utils import scale


@pytest.mark.mainnetFork
def test_swap_zero_amount(swapperRouter, dai, alice, usdc):
    dai.approve(swapperRouter, scale(10000), {"from": alice})
    daiBalance = dai.balanceOf(alice)
    usdcBalance = usdc.balanceOf(alice)
    tx = swapperRouter.swap(dai, usdc, scale(0), {"from": alice})
    assert tx.return_value == 0
    assert daiBalance == dai.balanceOf(alice)
    assert usdcBalance == usdc.balanceOf(alice)


@pytest.mark.mainnetFork
def test_reverts_sending_eth_to_erc20_swap(swapperRouter, dai, alice, usdc):
    dai.approve(swapperRouter, scale(10000), {"from": alice})
    with reverts("invalid amount"):
        swapperRouter.swap(dai, usdc, scale(100), {
                             "from": alice, "value": scale(1)})


@pytest.mark.mainnetFork
def test_reverts_swapping_eth_with_invalid_amount(swapperRouter, alice, usdc):
    with reverts("invalid amount"):
        swapperRouter.swap(ZERO_ADDRESS, usdc, scale(10), {
                             "from": alice, "value": scale(100)})


@pytest.mark.mainnetFork
def test_swap_all_weth_to_erc20(swapperRouter, alice, usdc, weth, charlie):
    weth.transfer(charlie, weth.balanceOf(alice) - scale(5), {"from": alice})
    toBalance = usdc.balanceOf(alice)
    weth.approve(swapperRouter, scale(1000000), {"from": alice})
    expected = swapperRouter.getAmountOut(weth, usdc, weth.balanceOf(alice))
    tx = swapperRouter.swapAll(weth, usdc, {"from": alice})
    assert weth.balanceOf(alice) == 0
    gained = usdc.balanceOf(alice) - toBalance
    assert gained > 0
    assert gained == tx.return_value
    assert gained == expected


@pytest.mark.mainnetFork
def test_swap_in_weth_to_erc20(swapperRouter, alice, usdc, weth):
    fromBalance = weth.balanceOf(alice)
    toBalance = usdc.balanceOf(alice)
    weth.approve(swapperRouter, scale(1000000), {"from": alice})
    expected = swapperRouter.getAmountOut(weth, usdc, scale(100))
    tx = swapperRouter.swap(weth, usdc, scale(100), {"from": alice})
    assert weth.balanceOf(alice) == fromBalance - scale(100)
    gained = usdc.balanceOf(alice) - toBalance
    assert gained > 0
    assert gained == tx.return_value
    assert gained == expected


@pytest.mark.mainnetFork
def test_swap_all_weth_to_eth(swapperRouter, alice, weth):
    toBalance = alice.balance()
    weth.approve(swapperRouter, scale(1000000), {"from": alice})
    expected = swapperRouter.getAmountOut(
        weth, ZERO_ADDRESS, weth.balanceOf(alice))
    tx = swapperRouter.swapAll(weth, ZERO_ADDRESS, {"from": alice})
    assert weth.balanceOf(alice) == 0
    gained = alice.balance() - toBalance
    assert gained > 0
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert pytest.approx(gained) == tx.return_value - wei_used_for_gas
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_in_weth_to_eth(swapperRouter, alice, weth):
    fromBalance = weth.balanceOf(alice)
    toBalance = alice.balance()
    weth.approve(swapperRouter, scale(1000000), {"from": alice})
    expected = swapperRouter.getAmountOut(weth, ZERO_ADDRESS, scale(100))
    tx = swapperRouter.swap(
        weth, ZERO_ADDRESS, scale(100), {"from": alice})
    assert weth.balanceOf(alice) == fromBalance - scale(100)
    gained = alice.balance() - toBalance
    assert gained > 0
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert pytest.approx(gained, abs=1e16) == tx.return_value - wei_used_for_gas
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_all_weth_to_weth(swapperRouter, alice, weth):
    fromBalance = weth.balanceOf(alice)
    weth.approve(swapperRouter, scale(1000000), {"from": alice})
    expected = swapperRouter.getAmountOut(weth, weth, fromBalance)
    tx = swapperRouter.swapAll(weth, weth, {"from": alice})
    assert weth.balanceOf(alice) == fromBalance
    assert tx.return_value == fromBalance
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_in_weth_to_weth(swapperRouter, alice, weth):
    fromBalance = weth.balanceOf(alice)
    weth.approve(swapperRouter, scale(1000000), {"from": alice})
    expected = swapperRouter.getAmountOut(weth, weth, scale(10))
    tx = swapperRouter.swap(weth, weth, scale(10), {"from": alice})
    assert weth.balanceOf(alice) == fromBalance
    assert tx.return_value == scale(10)
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_all_eth_to_eth(swapperRouter, alice):
    fromBalance = alice.balance()
    expected = swapperRouter.getAmountOut(
        ZERO_ADDRESS, ZERO_ADDRESS, scale(100))
    tx = swapperRouter.swapAll(ZERO_ADDRESS, ZERO_ADDRESS, {
                               "from": alice, "value": scale(100)})
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert alice.balance() == fromBalance - wei_used_for_gas
    assert tx.return_value == scale(100)
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_in_eth_to_eth(swapperRouter, alice):
    fromBalance = alice.balance()
    expected = swapperRouter.getAmountOut(
        ZERO_ADDRESS, ZERO_ADDRESS, scale(100))
    tx = swapperRouter.swap(ZERO_ADDRESS, ZERO_ADDRESS, scale(
        100), {"from": alice, "value": scale(100)})
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert alice.balance() == fromBalance - wei_used_for_gas
    assert tx.return_value == scale(100)
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_all_eth_to_weth(swapperRouter, alice, weth):
    fromBalance = alice.balance()
    toBalance = weth.balanceOf(alice)
    expected = swapperRouter.getAmountOut(ZERO_ADDRESS, weth, scale(100))
    tx = swapperRouter.swapAll(
        ZERO_ADDRESS, weth, {"from": alice, "value": scale(100)})
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert alice.balance() == fromBalance - scale(100) - wei_used_for_gas
    gained = weth.balanceOf(alice) - toBalance
    assert gained == scale(100)
    assert gained == tx.return_value
    assert gained == expected


@pytest.mark.mainnetFork
def test_swap_in_eth_to_weth(swapperRouter, alice, weth):
    fromBalance = alice.balance()
    toBalance = weth.balanceOf(alice)
    expected = swapperRouter.getAmountOut(ZERO_ADDRESS, weth, scale(100))
    tx = swapperRouter.swap(ZERO_ADDRESS, weth, scale(100), {
        "from": alice, "value": scale(100)})
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert alice.balance() == fromBalance - scale(100) - wei_used_for_gas
    gained = weth.balanceOf(alice) - toBalance
    assert gained == scale(100)
    assert gained == tx.return_value
    assert gained == expected


@pytest.mark.mainnetFork
def test_swap_all_eth_to_erc20(swapperRouter, alice, dai):
    fromBalance = alice.balance()
    toBalance = dai.balanceOf(alice)
    expected = swapperRouter.getAmountOut(ZERO_ADDRESS, dai, scale(2))
    tx = swapperRouter.swapAll(
        ZERO_ADDRESS, dai, {"from": alice, "value": scale(2)})
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert alice.balance() == fromBalance - scale(2) - wei_used_for_gas
    gained = dai.balanceOf(alice) - toBalance
    assert gained > 0
    assert pytest.approx(gained) == tx.return_value
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_in_eth_to_erc20(swapperRouter, alice, dai):
    fromBalance = alice.balance()
    toBalance = dai.balanceOf(alice)
    expected = swapperRouter.getAmountOut(ZERO_ADDRESS, dai, scale(2))
    tx = swapperRouter.swap(ZERO_ADDRESS, dai, scale(2), {
        "from": alice, "value": scale(2)})
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert alice.balance() == fromBalance - scale(2) - wei_used_for_gas
    gained = dai.balanceOf(alice) - toBalance
    assert gained > 0
    assert pytest.approx(gained) == tx.return_value
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_all_erc20_to_weth(swapperRouter, alice, usdc, weth):
    toBalance = weth.balanceOf(alice)
    usdc.approve(swapperRouter, scale(1000000), {"from": alice})
    expected = swapperRouter.getAmountOut(usdc, weth, usdc.balanceOf(alice))
    tx = swapperRouter.swapAll(usdc, weth, {"from": alice})
    assert usdc.balanceOf(alice) == 0
    gained = weth.balanceOf(alice) - toBalance
    assert gained > 0
    assert pytest.approx(gained) == tx.return_value
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_in_erc20_to_weth(swapperRouter, alice, usdc, weth):
    fromBalance = usdc.balanceOf(alice)
    toBalance = weth.balanceOf(alice)
    usdc.approve(swapperRouter, scale(1000000, 6), {"from": alice})
    expected = swapperRouter.getAmountOut(usdc, weth, scale(1000, 6))
    tx = swapperRouter.swap(usdc, weth, scale(1000, 6), {"from": alice})
    assert usdc.balanceOf(alice) == fromBalance - scale(1000, 6)
    gained = weth.balanceOf(alice) - toBalance
    assert gained > 0
    assert gained == tx.return_value
    assert gained == expected


@pytest.mark.mainnetFork
def test_swap_all_erc20_to_eth(swapperRouter, alice, crv, charlie):
    crv.transfer(charlie, crv.balanceOf(alice) - scale(100), {"from": alice})
    toBalance = alice.balance()
    crv.approve(swapperRouter, scale(1000000), {"from": alice})
    expected = swapperRouter.getAmountOut(
        crv, ZERO_ADDRESS, crv.balanceOf(alice))
    tx = swapperRouter.swapAll(crv, ZERO_ADDRESS, {"from": alice})
    assert crv.balanceOf(alice) == 0
    gained = alice.balance() - toBalance
    assert gained > 0
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert pytest.approx(gained, abs=0.0003e18) == tx.return_value - wei_used_for_gas
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_in_erc20_to_eth(swapperRouter, alice, crv):
    fromBalance = crv.balanceOf(alice)
    toBalance = alice.balance()
    crv.approve(swapperRouter, scale(1000000), {"from": alice})
    expected = swapperRouter.getAmountOut(crv, ZERO_ADDRESS, scale(100))
    tx = swapperRouter.swap(
        crv, ZERO_ADDRESS, scale(100), {"from": alice})
    assert crv.balanceOf(alice) == fromBalance - scale(100)
    gained = alice.balance() - toBalance
    assert gained > 0
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert pytest.approx(gained, abs=0.0003e18) == tx.return_value - wei_used_for_gas
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_all_erc20_to_erc20(swapperRouter, alice, crv, dai, charlie):
    crv.transfer(charlie, crv.balanceOf(alice) - scale(200), {"from": alice})

    toBalance = dai.balanceOf(alice)
    crv.approve(swapperRouter, scale(2000), {"from": alice})
    expected = swapperRouter.getAmountOut(crv, dai, crv.balanceOf(alice))
    tx = swapperRouter.swapAll(crv, dai, {"from": alice})
    assert crv.balanceOf(alice) == 0
    gained = dai.balanceOf(alice) - toBalance
    assert gained > 0
    assert gained == tx.return_value
    assert gained == expected


@pytest.mark.mainnetFork
def test_swap_in_erc20_to_erc20(swapperRouter, alice, crv, dai):
    fromBalance = crv.balanceOf(alice)
    toBalance = dai.balanceOf(alice)
    crv.approve(swapperRouter, scale(1000000), {"from": alice})
    expected = swapperRouter.getAmountOut(crv, dai, scale(100))
    tx = swapperRouter.swap(crv, dai, scale(100), {"from": alice})
    assert crv.balanceOf(alice) == fromBalance - scale(100)
    gained = dai.balanceOf(alice) - toBalance
    assert gained > 0
    assert gained == tx.return_value
    assert gained == expected


@pytest.mark.mainnetFork
def test_swap_in_eth_curve_swap(swapperRouter, alice, crv, admin):
    swapperRouter.setCurvePool(crv, VendorAddresses.CURVE_CRV_ETH_POOL, {"from": admin})
    swapperRouter.setSlippageTolerance(scale("0.5"), {"from": admin})
    fromBalance = alice.balance()
    toBalance = crv.balanceOf(alice)
    expected = swapperRouter.getAmountOut(ZERO_ADDRESS, crv, scale(2))
    tx = swapperRouter.swap(ZERO_ADDRESS, crv, scale(2), {
        "from": alice, "value": scale(2)})
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert alice.balance() == fromBalance - scale(2) - wei_used_for_gas
    gained = crv.balanceOf(alice) - toBalance
    assert gained > 0
    assert pytest.approx(gained) == tx.return_value
    assert tx.return_value == expected


@pytest.mark.mainnetFork
def test_swap_in_erc20_curve_swap(swapperRouter, alice, crv, admin):
    swapperRouter.setCurvePool(crv, VendorAddresses.CURVE_CRV_ETH_POOL, {"from": admin})
    fromBalance = crv.balanceOf(alice)
    toBalance = alice.balance()
    crv.approve(swapperRouter, scale(10_000), {"from": alice})
    expected = swapperRouter.getAmountOut(crv, ZERO_ADDRESS, scale(10_000))
    tx = swapperRouter.swap(
        crv, ZERO_ADDRESS, scale(10_000), {"from": alice})
    assert crv.balanceOf(alice) == fromBalance - scale(10_000)
    gained = alice.balance() - toBalance
    assert gained > 0
    wei_used_for_gas = tx.gas_used * tx.gas_price
    assert pytest.approx(gained, abs=0.0003e18) == tx.return_value - wei_used_for_gas
    assert tx.return_value == expected
