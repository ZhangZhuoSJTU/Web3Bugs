#!/usr/bin/python3

import pytest
import json
from brownie import ZERO_ADDRESS, chain

DAY = 86400
WEEK = DAY * 7
YEAR = 365 * 86400
EPOCH = WEEK
EMISSIONS_IN_FIRST_EPOCH = 2_472_621 * 125 // 1000
INFLATION_DELAY = 3 * 3600

data = json.load(open('config/pooldata.json', 'r'))
lp_token_address = data.get('lp_token_address')
swap_constructor = data.get('swap_constructor')
coins = data.get('coins')

# wBTC = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"
# sBTC = "0xfe18be6b3bd88a2d2a7f928d00292e7a9963cfc6"
# renBTC = "0xeb4c2781e4eba804ce9a9803c67d0893436bb27d"
# LPBTC = "0x28a8746e75304c0780E011BEd21C72cD78cd535E"
A_BTC = 0
_init_fee_BTC = 0
_admin_fee_BTC = 0

# USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"
# USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
# TUSD = "0x0000000000085d4780B73119b644AE5ecd22b376"
# DAI = "0x6b175474e89094c44da98b954eedeac495271d0f"
# LPUSD = "0x28a8746e75304c0780E011BEd21C72cD78cd535E"
A_USD = 0
_init_fee_USD = 0

# WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
# WETH1 = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
# LPETH = "0x28a8746e75304c0780E011BEd21C72cD78cd535E"
A_ETH = swap_constructor.get('_A')
_init_fee_ETH = swap_constructor.get('_fee')
_admin_fee_ETH = swap_constructor.get('_admin_fee')

USD_LP_TOKEN_NAME = "USD LP Token Name"
USD_LP_TOKEN_SYMBOL = "USD LP Token Symbol"
USD_LP_TOKEN_DECIMALS = 18
USD_LP_TOKEN_SUPPLY = 10 ** 9

BTC_LP_TOKEN_NAME = "BTC LP Token Name"
BTC_LP_TOKEN_SYMBOL = "BTC LP Token Symbol"
BTC_LP_TOKEN_DECIMALS = 18
BTC_LP_TOKEN_SUPPLY = 10 ** 9

ETH_LP_TOKEN_NAME = "ETH LP Token Name"
ETH_LP_TOKEN_SYMBOL = "ETH LP Token Symbol"
ETH_LP_TOKEN_DECIMALS = 18
ETH_LP_TOKEN_SUPPLY = 10 ** 9


def approx(a, b, precision=1e-10):
    if a == b == 0:
        return True
    return 2 * abs(a - b) / (a + b) <= precision


def pytest_addoption(parser):
    parser.addoption(
        "--runlong", action="store_true", default=False, help="run long tests"
    )


def pytest_collection_modifyitems(config, items):
    if config.getoption("--runlong"):
        # --runslow given in cli: do not skip slow tests
        return
    skip_long = pytest.mark.skip(reason="need --runlong option to run")
    for item in items:
        if "long" in item.keywords:
            item.add_marker(skip_long)


@pytest.fixture(scope="function", autouse=True)
def isolate(fn_isolation):
    # perform a chain rewind after completing each test, to ensure proper isolation
    # https://eth-brownie.readthedocs.io/en/v1.10.3/tests-pytest-intro.html#isolation-fixtures
    pass


@pytest.fixture(scope="session")
def admin(accounts):
    return accounts[0] # owns the deployment process and resulting contract instances

@pytest.fixture(scope="session")
def provider(accounts):
    return accounts[1] # provides liquidity, synonym for trader1

@pytest.fixture(scope="session")
def alice(provider):
    return provider

@pytest.fixture(scope="session")
def provider1(accounts):
    return accounts[1] # provides liquidity

@pytest.fixture(scope="session")
def provider2(accounts):
    return accounts[2] # provides liquidity 

@pytest.fixture(scope="session")
def provider3(accounts):
    return accounts[3] # provides liquidity 

@pytest.fixture(scope="session")
def trader(accounts):
    return accounts[4] # trades/swaps via custom swap, synonym for trader1

@pytest.fixture(scope="session")
def bob(trader):
    return trader

@pytest.fixture(scope="session")
def trader1(accounts):
    return accounts[4] # trades/swaps via custom swap

@pytest.fixture(scope="session")
def trader2(accounts):
    return accounts[5] # trades/swaps via custom swap

@pytest.fixture(scope="session")
def trader3(accounts):
    return accounts[6] # trades/swaps via custom swap

@pytest.fixture(scope="session")
def charlie(accounts):
    return accounts[7] # innocent bystander

@pytest.fixture(scope="session")
def chuck(accounts):
    return accounts[8] # malicious intent

@pytest.fixture(scope="module")
def boot(MainToken, admin):
    mainToken = MainToken.deploy("BOOT Finance Token", "BOOT", 18, {'from': admin})
    # sync chain time with 0th epoch start time
    chain.sleep(mainToken.start_epoch_time() + EPOCH - chain.time())
    mainToken.update_mining_parameters()
    return mainToken

@pytest.fixture(scope="module")
def gauge_controller(admin, GaugeController):
    return GaugeController.deploy({'from': admin})
 
@pytest.fixture(scope="module")
def minter(boot, gauge_controller, admin, Minter):
    m = Minter.deploy(boot.address, gauge_controller.address, ZERO_ADDRESS, {'from': admin})
    boot.set_minter(m)
    return m

@pytest.fixture(scope="module")
def faucet(boot, minter, accounts):
    advance_epochs(52, boot)
    qty = boot.available_supply()
    assert qty != 0
    n = 10 * 10**24
    assert boot.mint(accounts[0], n, {'from': minter})
    balance = boot.balanceOf(accounts[0])
    assert balance == n
    return accounts[0]

# A number of ERC20 tests in tests/token expect accounts[0] to be the faucet
# and assume the token fixture is the main BOOT token.
#
@pytest.fixture(scope="module")
def token(boot):
    return boot

@pytest.fixture(scope="module")
def wBTC(Token, faucet):
    return Token.deploy("wBTC Token", "wBTC", 18, 1e21, {'from': faucet})
@pytest.fixture(scope="module")
def sBTC(Token, faucet):
    return Token.deploy("sBTC Token", "sBTC", 18, 1e21, {'from': faucet})
@pytest.fixture(scope="module")
def renBTC(Token, faucet):
    return Token.deploy("renBTC Token", "renBTC", 18, 1e21, {'from': faucet})
@pytest.fixture(scope="module")
def LPBTC(Token, faucet):
    return Token.deploy("LPBTC Token", "LPBTC", 18, 1e21, {'from': faucet})

@pytest.fixture(scope="module")
def USDT(Token, faucet):
    return Token.deploy("USDT Token", "USDT", 18, 1e21, {'from': faucet})
@pytest.fixture(scope="module")
def USDC(Token, faucet):
    return Token.deploy("USDC Token", "USDC", 18, 1e21, {'from': faucet})
@pytest.fixture(scope="module")
def TUSD(Token, faucet):
    return Token.deploy("TUSD Token", "TUSD", 18, 1e21, {'from': faucet})
@pytest.fixture(scope="module")
def DAI(Token, faucet):
    return Token.deploy("DAI Token", "DAI", 18, 1e21, {'from': faucet})
@pytest.fixture(scope="module")
def LPUSD(Token, faucet):
    return Token.deploy("LPUSD Token", "LPUSD", 18, 1e21, {'from': faucet})

@pytest.fixture(scope="module")
def WETH(Token, faucet):
    return Token.deploy("WETH Token", "WETH", 18, 1e21, {'from': faucet})
@pytest.fixture(scope="module")
def WETH1(Token, faucet):
    return Token.deploy("WETH1 Token", "WETH1", 18, 1e21, {'from': faucet})
@pytest.fixture(scope="module")
def LPETH(Token, faucet):
    return Token.deploy("LPETH Token", "LPETH", 18, 1e21, {'from': faucet})

@pytest.fixture(scope="module")
def usdLPToken(admin, LPToken):
    return LPToken.deploy(USD_LP_TOKEN_NAME, USD_LP_TOKEN_SYMBOL, USD_LP_TOKEN_DECIMALS, USD_LP_TOKEN_SUPPLY, {'from': admin})
@pytest.fixture(scope="module")
def btcLPToken(admin, LPToken):
    return LPToken.deploy(BTC_LP_TOKEN_NAME, BTC_LP_TOKEN_SYMBOL, BTC_LP_TOKEN_DECIMALS, BTC_LP_TOKEN_SUPPLY, {'from': admin})
@pytest.fixture(scope="module")
def ethLPToken(admin, LPToken):
    return LPToken.deploy(ETH_LP_TOKEN_NAME, ETH_LP_TOKEN_SYMBOL, ETH_LP_TOKEN_DECIMALS, ETH_LP_TOKEN_SUPPLY, {'from': admin})

@pytest.fixture(scope="module")
def mock_lp_token(admin, LPToken):
    return LPToken.deploy("Mock LP Token", "MOCKLP", 18, 10**9, {'from': admin})

@pytest.fixture(scope="module")
def usdPoolGauge(minter, admin, usdLPToken, gauge_controller, PoolGauge):
    r = PoolGauge.deploy(usdLPToken.address, minter.address, {'from': admin})
    gauge_controller.add_gauge(r.address, 0, 1)
    return r
@pytest.fixture(scope="module")
def btcPoolGauge(minter, admin, btcLPToken, gauge_controller, PoolGauge):
    r = PoolGauge.deploy(btcLPToken.address, minter.address, {'from': admin})
    gauge_controller.add_gauge(r.address, 1, 1)
    return r
@pytest.fixture(scope="module")
def ethPoolGauge(minter, admin, ethLPToken, gauge_controller, PoolGauge):
    r = PoolGauge.deploy(ethLPToken.address, minter.address, {'from': admin})
    gauge_controller.add_gauge(r.address, 1, 1)
    return r

@pytest.fixture(scope="module")
def btcPool(BTCPoolDelegator, admin, wBTC, sBTC, renBTC, LPBTC):
    return BTCPoolDelegator.deploy(admin,
        [wBTC.address, sBTC.address, renBTC.address],
        LPBTC.address, A_BTC, _init_fee_BTC, _admin_fee_BTC, {'from': admin})

@pytest.fixture(scope="module")
def usdPool(USDPoolDelegator, admin, USDT, USDC, TUSD, DAI, LPUSD):
    return USDPoolDelegator.deploy(
        [USDT.address, USDC.address, TUSD.address, DAI.address],
        [USDT.address, USDC.address, TUSD.address, DAI.address],
        LPUSD.address, A_USD, _init_fee_USD, {'from': admin})

@pytest.fixture(scope="module")
def ethPool(ETHPoolDelegator, admin, WETH, WETH1, LPETH):
    return ETHPoolDelegator.deploy(admin,
        [WETH.address, WETH1.address],
        LPETH.address, A_ETH, _init_fee_ETH, _admin_fee_ETH, {'from': admin})

@pytest.fixture(scope="module")
def ethPoolD(ETHPoolDelegator, admin):
    return ETHPoolDelegator.deploy(admin, coins, lp_token_address, A_ETH, _init_fee_ETH, _admin_fee_ETH, {'from': admin})


@pytest.fixture(scope="module")
def three_gauges(PoolGauge, admin, mock_lp_token, minter):
    return [
        PoolGauge.deploy(mock_lp_token, minter, {"from": admin})
        for _ in range(3)
    ]

@pytest.fixture(scope="module")
def pool_gauge(minter, admin, mock_lp_token, gauge_controller, PoolGauge):
    return PoolGauge.deploy(mock_lp_token.address, minter.address, {'from': admin})


@pytest.fixture(scope="module")
def theoretical_supply(chain, token):
    def _fn():
        epoch = token.mining_epoch()
        q = 1 / 2 ** 0.25
        S = 0
        if epoch > 0:
            S += int(EMISSIONS_IN_FIRST_EPOCH * (1 - q ** epoch) / (1 - q))
        S += int(EMISSIONS_IN_FIRST_EPOCH // EPOCH * q ** epoch) * (
            chain[-1].timestamp - token.start_epoch_time()
        )
        return S

    yield _fn


def advance_epochs(n, boot):
    for i in range(n):
        advance_one(boot)

def advance_one(boot):
    next = boot.start_epoch_time() + EPOCH
    chain.sleep(next - chain.time())
    boot.update_mining_parameters()


# due to vesting keeping 70% we will only see 30% from most mints
def fully_vested(x, percent=0.3):
    return x * (1 - percent) / percent
