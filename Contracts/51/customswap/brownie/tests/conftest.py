#!/usr/bin/python3

import pytest


MAX_UINT256 = 2**256 - 1

# From SwapUtils impl:
# TBD: Should there be a way to get these from the contract?
#
A_PRECISION = 100
MAX_A = 10**6
MAX_A_CHANGE = 2
MIN_RAMP_TIME = 14 * 24 * 60 * 60
ONE_DAY = 24 * 60 * 60


pytest_plugins = [
    "fixtures.accounts",
    "fixtures.coins",
    "fixtures.functions",
    "fixtures.setup",
]

# functions in wrapped methods are renamed to simplify common tests

WRAPPED_COIN_METHODS = {
    "ATokenMock": {"get_rate": "_get_rate", "mint": "mint"},
    "cERC20": {"get_rate": "exchangeRateStored", "mint": "mint"},
    "IdleToken": {"get_rate": "tokenPrice", "mint": "mintIdleToken"},
    "renERC20": {"get_rate": "exchangeRateCurrent"},
    "yERC20": {"get_rate": "getPricePerFullShare", "mint": "deposit"},
    "aETH": {"get_rate": "ratio"},
    "rETH": {"get_rate": "getExchangeRate"},
}


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "itercoins: parametrize a test with one or more ranges, equal to the length "
        "of `wrapped_coins` for the active pool",
    )


def pytest_generate_tests(metafunc):
    # apply initial parametrization of `itercoins`
    for marker in metafunc.definition.iter_markers(name="itercoins"):
        for item in marker.args:
            metafunc.parametrize(item, range(2)) # since there are 2 coins in the customswap


def pytest_collection_modifyitems(config, items):
    for item in items.copy():
        try:
            params = item.callspec.params
        except Exception:
            continue

        # remove excess `itercoins` parametrized tests
        for marker in item.iter_markers(name="itercoins"):
            n_coins = 2
            values = [params[i] for i in marker.args]
            if max(values) >= n_coins or len(set(values)) < len(values):
                items.remove(item)
                break

        if item not in items:
            continue

    # hacky magic to ensure the correct number of tests is shown in collection report
    config.pluginmanager.get_plugin("terminalreporter")._numcollected = len(items)


@pytest.hookimpl(trylast=True)
def pytest_sessionfinish(session, exitstatus):
    if exitstatus == pytest.ExitCode.NO_TESTS_COLLECTED:
        # because of how tests are filtered in the CI, we treat "no tests collected" as passing
        session.exitstatus = pytest.ExitCode.OK


# isolation setup


@pytest.fixture(autouse=True)
def isolation_setup(fn_isolation):
    pass


@pytest.fixture(scope="module", autouse=True)
def math_utils(MathUtils, admin):
    return MathUtils.deploy({'from':admin})


@pytest.fixture(scope="module", autouse=True)
def swap_utils(SwapUtils, math_utils, admin):
    return SwapUtils.deploy({'from':admin})


@pytest.fixture(scope="module")
def swap(Swap, swap_utils, coins, decimals, admin):
    return Swap.deploy(
        coins, #[coin.address for coin in coins],
        decimals,
        'USD Liquidity',
        'USDLP',
        1,      # a
        1,      # a2
        0,      # swap fee
        0,      # admin fee
        0,      # withdraw fee
        10**18, # Initial Target Price
        {'from': admin})


@pytest.fixture(scope="module")
def swap_1(swap):
    return swap


@pytest.fixture(scope="module")
def swap_10(Swap, swap_utils, coins, decimals, admin):
    return Swap.deploy(
        coins, #[coin.address for coin in coins],
        decimals,
        'USD Liquidity',
        'USDLP',
        10,     # a
        10,     # a2
        0,      # swap fee
        0,      # admin fee
        0,      # withdraw fee
        10**18, # Initial Target Price
        {'from': admin})


@pytest.fixture(scope="module")
def swap_100(Swap, swap_utils, coins, decimals, admin):
    return Swap.deploy(
        coins, #[coin.address for coin in coins],
        decimals,
        'USD Liquidity',
        'USDLP',
        100,    # a
        100,    # a2
        0,      # swap fee
        0,      # admin fee
        0,      # withdraw fee
        10**18, # Initial Target Price
        {'from': admin})


@pytest.fixture(scope="module")
def swap_1000(Swap, swap_utils, coins, decimals, admin):
    return Swap.deploy(
        coins, #[coin.address for coin in coins],
        decimals,
        'USD Liquidity',
        'USDLP',
        1000,   # a
        1000,   # a2
        0,      # swap fee
        0,      # admin fee
        0,      # withdraw fee
        10**18, # Initial Target Price
        {'from': admin})


@pytest.fixture(scope="module")
def swap_10_100(Swap, swap_utils, coins, decimals, admin):
    return Swap.deploy(
        coins, #[coin.address for coin in coins],
        decimals,
        'USD Liquidity',
        'USDLP',
        10,     # a
        100,    # a2
        0,      # swap fee
        0,      # admin fee
        0,      # withdraw fee
        10**18, # Initial Target Price
        {'from': admin})


@pytest.fixture(scope="module")
def swap_100_10(Swap, swap_utils, coins, decimals, admin):
    return Swap.deploy(
        coins, #[coin.address for coin in coins],
        decimals,
        'USD Liquidity',
        'USDLP',
        100,    # a
        10,     # a2
        0,      # swap fee
        0,      # admin fee
        0,      # withdraw fee
        10**18, # Initial Target Price
        {'from': admin})


@pytest.fixture(scope="module")
def liquidity(swap, LPToken):
    return LPToken.at(swap.swapStorage()['lpToken'])
