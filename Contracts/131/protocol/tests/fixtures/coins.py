import time
from functools import lru_cache

import pytest
from brownie import ZERO_ADDRESS, MockErc20, MockCurveSwap, interface  # type: ignore
from support.utils import scale
from support.mainnet_contracts import TokenAddresses, VendorAddresses

UNSCALED_MINT_AMOUNT = 500_000
DEFAULT_MINT_AMOUNT = scale(UNSCALED_MINT_AMOUNT)
USDC_DEFAULT_MINT_AMOUNT = scale(UNSCALED_MINT_AMOUNT, 6)

PATHS_OVERRIDES = {TokenAddresses.CVX_CRV: [TokenAddresses.WETH, TokenAddresses.CRV]}


@lru_cache()
def get_uniswappish_routers():
    uniswap_router = interface.UniswapRouter02(VendorAddresses.UNISWAP_ROUTER)
    sushiswap_router = interface.UniswapRouter02(VendorAddresses.SUSHISWAP_ROUTER)
    return [uniswap_router, sushiswap_router]


def mint_max_coin_for(account, coin):
    path = PATHS_OVERRIDES.get(coin, [TokenAddresses.WETH]) + [coin]
    amount_in = account.balance() - scale(10)
    amount = max(
        [
            router.getAmountsOut(amount_in, path)[-1]
            for router in get_uniswappish_routers()
        ]
    )
    return mint_coin_for(account, coin, amount)


def mint_coin_for(account, coin, token_amount=DEFAULT_MINT_AMOUNT):
    if hasattr(coin, "address"):
        coin = coin.address
    if coin == TokenAddresses.TRI_CRV:
        return mint_tricrv_for(account, token_amount)
    if coin == TokenAddresses.CVX_CRV:
        return mint_cvxcrv_for(account, token_amount)
    if coin == TokenAddresses.CVX:
        return mint_cvx_for(account, token_amount)
    if coin == TokenAddresses.CRV:
        return mint_crv_for(account, token_amount)
    deadline = 2**256 - 1
    exc = None
    path = PATHS_OVERRIDES.get(coin, [TokenAddresses.WETH]) + [coin]
    previous_balance = interface.ERC20(coin).balanceOf(account)
    for router in get_uniswappish_routers():
        try:
            amounts_in = router.getAmountsIn(token_amount, path)
            router.swapETHForExactTokens(
                token_amount,
                path,
                account,
                deadline,
                {"from": account, "value": amounts_in[0]},
            )
            return interface.ERC20(coin).balanceOf(account) - previous_balance
        except ValueError as ex:
            exc = ex

    assert exc is not None
    raise exc


# Custom mint logic
def mint_tricrv_for(account, amount=DEFAULT_MINT_AMOUNT):
    amounts = [amount] + [amount // 10 ** 12] * 2
    mint_coin_for(account, TokenAddresses.DAI, amounts[0])
    mint_coin_for(account, TokenAddresses.USDC, amounts[1])
    mint_coin_for(account, TokenAddresses.USDT, amounts[2])
    tricrv = interface.ERC20(TokenAddresses.TRI_CRV)
    for coin, amount in zip([TokenAddresses.DAI, TokenAddresses.USDC, TokenAddresses.USDT], amounts):
        interface.ERC20(coin).approve(VendorAddresses.TRICRV_POOL, amount, {"from": account})
    curve_swap = MockCurveSwap.at(VendorAddresses.TRICRV_POOL)
    previous_balance = tricrv.balanceOf(account)
    curve_swap.add_liquidity(amounts, 0, {"from": account})
    return tricrv.balanceOf(account) - previous_balance


def mint_cvxcrv_for(account, amount=DEFAULT_MINT_AMOUNT):
    minted = mint_coin_for(account, TokenAddresses.CRV, amount)
    interface.ERC20(TokenAddresses.CRV).approve(
        VendorAddresses.CONVEX_CRV_DEPOSITOR, amount, {"from": account}
    )
    interface.ICrvDepositor(VendorAddresses.CONVEX_CRV_DEPOSITOR).deposit(
        amount, False, ZERO_ADDRESS, {"from": account}
    )
    return interface.ERC20(TokenAddresses.CVX_CRV).balanceOf(account)


def mint_cvx_for(account, amount=DEFAULT_MINT_AMOUNT):
    # this is a bit hacky, but avoids the overhead of having to compute the exact dx amount we need
    # to swap on Curve to get the desired dy amount. We swap 1000 ETH for CVX and burn the rest to get
    # to the desired balance.
    oldBalance = interface.ERC20(TokenAddresses.CVX).balanceOf(account)
    interface.ICurveCryptoSwap(VendorAddresses.CURVE_CVX_ETH_POOL).exchange_underlying(
        0, 1, 1000 * 1e18, amount, {"value": 1000 * 1e18, "from": account}
    )
    newBalance = interface.ERC20(TokenAddresses.CVX).balanceOf(account)
    if newBalance >= amount + oldBalance:
        interface.ERC20(TokenAddresses.CVX).transfer(
            VendorAddresses.BURN_ADDRESS, newBalance - oldBalance - amount, {"from": account}
        )
    return interface.ERC20(TokenAddresses.CVX).balanceOf(account)


def mint_crv_for(account, amount=DEFAULT_MINT_AMOUNT):
    # this is a bit hacky, but avoids the overhead of having to compute the exact dx amount we need
    # to swap on Curve to get the desired dy amount. We swap 1000 ETH for CRV and burn the rest to get
    # to the desired balance.
    oldBalance = interface.ERC20(TokenAddresses.CRV).balanceOf(account)
    interface.ICurveCryptoSwap(VendorAddresses.CURVE_CRV_ETH_POOL).exchange_underlying(
        0, 1, 1000 * 1e18, amount, {"value": 1000 * 1e18, "from": account}
    )
    newBalance = interface.ERC20(TokenAddresses.CRV).balanceOf(account)
    if newBalance >= amount + oldBalance:
        interface.ERC20(TokenAddresses.CRV).transfer(
            VendorAddresses.BURN_ADDRESS, newBalance - oldBalance - amount, {"from": account}
        )
    return interface.ERC20(TokenAddresses.CRV).balanceOf(account)


@pytest.fixture(scope="module")
def decimals(pool_data):
    return pool_data.get("decimals")


@pytest.fixture(scope="module")
def coin(pool_data, admin, isForked, decimals, MockErc20):
    underlying = pool_data.get("underlying", False)
    if isForked:
        if underlying:
            if underlying == ZERO_ADDRESS:
                return underlying
            return interface.ERC20(underlying)
        else:
            return interface.ERC20(decimals=decimals)
    else:
        if underlying:
            if underlying == ZERO_ADDRESS:
                return underlying
        return admin.deploy(MockErc20, decimals)


@pytest.fixture(scope="module")
def lpToken(poolSetUp):
    return poolSetUp[1]


@pytest.fixture(scope="module")
def cappedLpToken(cappedPoolSetUp):
    return cappedPoolSetUp[1]


@pytest.fixture(scope="module")
def mockToken(MockErc20, admin):
    return admin.deploy(MockErc20, 18)


@pytest.fixture(scope="module")
def curveCoins(coin, isForked, admin):
    # a bit hacky for mocking curve coins. If `coin` is ETH then sETH pool coins are
    # used, else 3Pool coins are used
    if isForked:
        if coin == ZERO_ADDRESS:
            return [ZERO_ADDRESS, interface.ERC20(TokenAddresses.SETH)]
        else:
            return [
                interface.ERC20(address) if coin != address else coin
                for address in [TokenAddresses.DAI, TokenAddresses.USDC, TokenAddresses.USDT]
            ]
    else:
        if coin == ZERO_ADDRESS:
            return [ZERO_ADDRESS, admin.deploy(MockErc20, 18)]
        else:
            if coin.decimals() == 18:
                # coin is DAI
                return [coin, admin.deploy(MockErc20, 6), admin.deploy(MockErc20, 6)]
            else:
                # coin is USDC
                return [admin.deploy(MockErc20, 18), coin, admin.deploy(MockErc20, 6)]


@pytest.fixture(scope="module")
def dai(admin, alice, bob, isForked, MockErc20, interface):
    if not isForked:
        return admin.deploy(MockErc20, 18)
    for account in [admin, alice, bob]:
        mint_coin_for(account, TokenAddresses.DAI)
    return interface.ERC20(TokenAddresses.DAI)


@pytest.fixture(scope="module")
def usdc(admin, alice, bob, isForked, MockErc20, interface):
    if not isForked:
        return admin.deploy(MockErc20, 6)
    for account in [admin, alice, bob]:
        mint_coin_for(account, TokenAddresses.USDC, USDC_DEFAULT_MINT_AMOUNT)
    return interface.ERC20(TokenAddresses.USDC)


@pytest.fixture(scope="module")
def usdt(admin, alice, bob, isForked, MockErc20, interface):
    if not isForked:
        return admin.deploy(MockErc20, 6)
    for account in [admin, alice, bob]:
        mint_coin_for(account, TokenAddresses.USDT, USDC_DEFAULT_MINT_AMOUNT)
    return interface.ERC20(TokenAddresses.USDT)


@pytest.fixture(scope="module")
def crv(admin, alice, bob, isForked, MockErc20, interface):
    if not isForked:
        return admin.deploy(MockErc20, 18)
    for account in [admin, alice, bob]:
        mint_coin_for(account, TokenAddresses.CRV, DEFAULT_MINT_AMOUNT // 10)
    return interface.ERC20(TokenAddresses.CRV)


@pytest.fixture(scope="module")
def cvx(admin, alice, bob, isForked, MockErc20, interface):
    if not isForked:
        return admin.deploy(MockErc20, 18)
    for account in [admin, alice, bob]:
        mint_coin_for(account, TokenAddresses.CVX, DEFAULT_MINT_AMOUNT // 10)
    return interface.ERC20(TokenAddresses.CVX)


@pytest.fixture(scope="module")
def triCrv(admin, alice, bob, interface, isForked, MockErc20):
    if not isForked:
        return admin.deploy(MockErc20, 18)
    for account in [admin, alice, bob]:
        mint_tricrv_for(account)
    return interface.ERC20(TokenAddresses.TRI_CRV)


@pytest.fixture(scope="module")
def cvxcrv(admin, alice, bob, interface, isForked, MockErc20):
    if not isForked:
        return admin.deploy(MockErc20, 18)
    for account in [admin, alice, bob]:
        mint_coin_for(account, TokenAddresses.CVX_CRV, DEFAULT_MINT_AMOUNT // 10)
    return interface.ERC20(TokenAddresses.CVX_CRV)


@pytest.fixture(scope="module")
def uni(admin, alice, bob, interface, isForked, MockErc20):
    if not isForked:
        return admin.deploy(MockErc20, 18)
    for account in [admin, alice, bob]:
        mint_coin_for(account, TokenAddresses.UNI)
    return interface.ERC20(TokenAddresses.UNI)


@pytest.fixture(scope="module")
def sushi(admin, alice, bob, isForked, MockErc20, interface):
    if not isForked:
        return admin.deploy(MockErc20, 18)
    for account in [admin, alice, bob]:
        mint_coin_for(account, TokenAddresses.SUSHI, DEFAULT_MINT_AMOUNT // 100)
    return interface.ERC20(TokenAddresses.SUSHI)


@pytest.fixture(scope="module")
def weth(admin, alice, bob, isForked, MockErc20, interface):
    if not isForked:
        return admin.deploy(MockErc20, 18)
    token = interface.IWETH(TokenAddresses.WETH)
    for account in [admin, alice, bob]:
        token.deposit({"from": account, "value": scale(5000)})
    return token


@pytest.fixture(scope="module")
def wbtc(admin, alice, bob, isForked, MockErc20, interface):
    if not isForked:
        return admin.deploy(MockErc20, 8)
    for account in [admin, alice, bob]:
        mint_coin_for(account, TokenAddresses.WBTC, scale(100, 8))
    return interface.ERC20(TokenAddresses.WBTC)
