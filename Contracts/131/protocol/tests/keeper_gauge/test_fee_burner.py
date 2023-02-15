from tkinter.tix import MAX
from brownie import ZERO_ADDRESS, reverts
import pytest

from support.utils import scale

MAX_APPROVE = 2**256 - 1


def setup_pool(admin, LpToken, symbol, decimals, pool, StakerVault, controller, address_provider):
    lpToken = admin.deploy(LpToken)
    lpToken.initialize(symbol + " - Backd LP", "bkd" +
                       symbol, decimals, pool, {"from": admin})
    stakerVault = admin.deploy(StakerVault, controller)
    stakerVault.initialize(lpToken, {"from": admin})
    controller.addStakerVault(stakerVault, {"from": admin})
    pool.setLpToken(lpToken, {"from": admin})
    pool.setStaker({"from": admin})
    address_provider.addPool(pool, {"from": admin})
    return pool, lpToken


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def pools(
    StakerVault,
    admin,
    controller,
    Erc20Pool,
    EthPool,
    dai,
    usdc,
    crv,
    usdt,
    LpToken,
    address_provider
):
    tokens = [dai, usdc, crv, usdt]
    pools = []

    pool = admin.deploy(EthPool, controller)
    pool.initialize("ETH Pool", ZERO_ADDRESS, {"from": admin})
    pools.append(setup_pool(admin, LpToken, "ETH", 18, pool, StakerVault, controller, address_provider))

    for token in tokens:
        pool = admin.deploy(Erc20Pool, controller)
        symbol = token.symbol()
        pool.initialize(symbol + " Pool", token, ZERO_ADDRESS, {"from": admin})
        decimals = token.decimals() 
        pools.append(setup_pool(admin, LpToken, symbol, decimals, pool, StakerVault, controller, address_provider))

    return pools


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def ethPool(pools):
    return pools[0][0]


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def ethLpToken(pools):
    return pools[0][1]


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def daiPool(pools):
    return pools[1][0]


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def daiLpToken(pools):
    return pools[1][1]


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def usdcPool(pools):
    return pools[2][0]


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def usdcLpToken(pools):
    return pools[2][1]


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def crvPool(pools):
    return pools[3][0]


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def crvLpToken(pools):
    return pools[3][1]


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def usdtPool(pools):
    return pools[4][0]


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def usdtLpToken(pools):
    return pools[4][1]


@pytest.fixture(scope="module")
@pytest.mark.mainnetFork
def feeBurner(FeeBurner, address_provider, admin):
    return admin.deploy(FeeBurner, address_provider)


@pytest.mark.mainnetFork
def test_burn_erc20_to_erc20_pool(feeBurner, dai, alice, usdcLpToken, charlie):
    dai.transfer(charlie, dai.balanceOf(alice) - scale(10_000, 18), {"from": alice})
    dai.approve(feeBurner, MAX_APPROVE, {"from": alice})
    tx = feeBurner.burnToTarget([dai], usdcLpToken, {"from": alice})
    balance = usdcLpToken.balanceOf(alice)
    assert balance > 0
    assert balance == tx.return_value
    assert dai.balanceOf(alice) == 0


@pytest.mark.mainnetFork
def test_burn_eth_to_erc20_pool(feeBurner, alice, usdcLpToken):
    ethBalanceBefore = alice.balance()
    tx = feeBurner.burnToTarget([ZERO_ADDRESS],usdcLpToken, {"from": alice, "value": scale(10, 18)})
    balance = usdcLpToken.balanceOf(alice)
    assert balance > 0
    assert balance == tx.return_value
    assert alice.balance() == ethBalanceBefore - scale(10, 18) - tx.gas_used * tx.gas_price


@pytest.mark.mainnetFork
def test_burn_erc20_to_eth_pool(feeBurner, dai, alice, ethLpToken, charlie):
    dai.transfer(charlie, dai.balanceOf(alice) - scale(10_000, 18), {"from": alice})
    dai.approve(feeBurner, MAX_APPROVE, {"from": alice})
    tx = feeBurner.burnToTarget([dai], ethLpToken, {"from": alice})
    balance = ethLpToken.balanceOf(alice)
    assert balance > 0
    assert balance == tx.return_value
    assert dai.balanceOf(alice) == 0


@pytest.mark.mainnetFork
def test_burn_same_token_in_and_out(feeBurner, dai, alice, daiLpToken, charlie):
    dai.transfer(charlie, dai.balanceOf(alice) - scale(10_000, 18), {"from": alice})
    daiBalance = dai.balanceOf(alice)
    dai.approve(feeBurner, MAX_APPROVE, {"from": alice})
    tx = feeBurner.burnToTarget([dai], daiLpToken, {"from": alice})
    balance = daiLpToken.balanceOf(alice)
    assert balance == daiBalance
    assert tx.return_value == balance
    assert dai.balanceOf(alice) == 0


@pytest.mark.mainnetFork
def test_burn_no_balance_of_any(feeBurner, alice, daiLpToken, dai, usdc, crv, usdt, charlie):
    dai.transfer(charlie, dai.balanceOf(alice), {"from": alice})
    crv.transfer(charlie, crv.balanceOf(alice), {"from": alice})
    usdt.transfer(charlie, usdt.balanceOf(alice), {"from": alice})
    usdc.transfer(charlie, usdc.balanceOf(alice), {"from": alice})

    tx = feeBurner.burnToTarget([dai, usdc, crv, usdt, ZERO_ADDRESS], daiLpToken, {"from": alice})
    assert tx.return_value == 0


@pytest.mark.mainnetFork
def test_burn_all_to_erc20_pool(feeBurner, dai, alice, usdcLpToken, usdc, crv, weth, usdt, charlie):
    # Transferring
    dai.transfer(charlie, dai.balanceOf(alice) - scale(10_000, 18), {"from": alice})
    crv.transfer(charlie, crv.balanceOf(alice) - scale(10_000, 18), {"from": alice})
    usdt.transfer(charlie, usdt.balanceOf(alice) - scale(10_000, 6), {"from": alice})

    # Balances Before
    ethBalanceBefore = alice.balance()

    # Approvals
    dai.approve(feeBurner, MAX_APPROVE, {"from": alice})
    crv.approve(feeBurner, MAX_APPROVE, {"from": alice})
    usdt.approve(feeBurner, MAX_APPROVE, {"from": alice})

    # Burning
    tx = feeBurner.burnToTarget([dai, crv, usdt, ZERO_ADDRESS], usdcLpToken, {"from": alice, "value": scale(10, 18)})

    # Checks
    balance = usdcLpToken.balanceOf(alice)
    assert balance > 0
    assert balance == tx.return_value
    assert usdcLpToken.balanceOf(feeBurner) == 0
    assert feeBurner.balance() == 0
    assert pytest.approx(alice.balance()) == ethBalanceBefore - scale(10, 18) - tx.gas_used * tx.gas_price
    assert weth.balanceOf(feeBurner) == 0
    assert dai.balanceOf(feeBurner) == 0
    assert dai.balanceOf(alice) == 0
    assert usdt.balanceOf(feeBurner) == 0
    assert usdt.balanceOf(alice) == 0
    assert crv.balanceOf(feeBurner) == 0
    assert crv.balanceOf(alice) == 0
    assert usdc.balanceOf(feeBurner) == 0


@pytest.mark.mainnetFork
def test_burn_all_to_eth_pool(feeBurner, dai, alice, usdc, crv, weth, usdt, ethLpToken, charlie):
    # Transferring
    dai.transfer(charlie, dai.balanceOf(alice) - scale(10_000, 18), {"from": alice})
    crv.transfer(charlie, crv.balanceOf(alice) - scale(10_000, 18), {"from": alice})
    usdt.transfer(charlie, usdt.balanceOf(alice) - scale(10_000, 6), {"from": alice})
    usdc.transfer(charlie, usdc.balanceOf(alice) - scale(10_000, 6), {"from": alice})

    # Approvals
    dai.approve(feeBurner, MAX_APPROVE, {"from": alice})
    crv.approve(feeBurner, MAX_APPROVE, {"from": alice})
    usdt.approve(feeBurner, MAX_APPROVE, {"from": alice})
    usdc.approve(feeBurner, MAX_APPROVE, {"from": alice})

    # Burning
    tx = feeBurner.burnToTarget([dai, crv, usdt, usdc], ethLpToken, {"from": alice})

    # Checks
    balance = ethLpToken.balanceOf(alice)
    assert balance > 0
    assert balance == tx.return_value
    assert ethLpToken.balanceOf(feeBurner) == 0
    assert feeBurner.balance() == 0
    assert weth.balanceOf(feeBurner) == 0
    assert dai.balanceOf(feeBurner) == 0
    assert dai.balanceOf(alice) == 0
    assert usdt.balanceOf(feeBurner) == 0
    assert usdt.balanceOf(alice) == 0
    assert crv.balanceOf(feeBurner) == 0
    assert crv.balanceOf(alice) == 0
    assert usdc.balanceOf(feeBurner) == 0
    assert usdc.balanceOf(alice) == 0
    assert feeBurner.balance() == 0


@pytest.mark.mainnetFork
def test_reverts_sending_eth_for_non_eth_burn(feeBurner, dai, alice, charlie, usdcLpToken):
    dai.transfer(charlie, dai.balanceOf(alice) - scale(10_000, 18), {"from": alice})
    dai.approve(feeBurner, MAX_APPROVE, {"from": alice})

    with reverts("invalid msg.value"):
        feeBurner.burnToTarget([dai], usdcLpToken, {"from": alice, "value": scale(1, 18)})
