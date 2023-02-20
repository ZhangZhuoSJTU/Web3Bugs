import json
from pathlib import Path

import pytest
from brownie import ZERO_ADDRESS
from brownie._config import CONFIG
from brownie.network import priority_fee
from brownie.project.main import get_loaded_projects

pytest_plugins = [
    "fixtures.deployments",
    "fixtures.mainnet_deployments",
    "fixtures.accounts",
    "fixtures.coins",
    "fixtures.mocks",
    "fixtures.setup",
    "fixtures.inflation_kickoff",
]

_pooldata = {}


def pytest_addoption(parser):
    parser.addoption("--pool", help="only run tests for given pool")
    parser.addoption("--strategy", help="only run tests with given strategy")
    parser.addoption(
        "--type", help="only run tests for pool type", choices=["eth", "erc20"]
    )
    parser.addoption(
        "--skip-stateful", action="store_true", help="stateful tests should be skipped"
    )


def pytest_sessionstart():
    project = get_loaded_projects()[0]
    for path in [i for i in project._path.glob("tests/configs/*") if i.is_dir()]:

        with path.joinpath("testconf.json").open() as fp:
            _pooldata[path.name] = json.load(fp)
            pool_impl = (
                "MockEthPool.sol" if "eth" in path.name else "MockErc20Pool.sol"
            )  # Mock pools wrap real implementations
            _pooldata[path.name].update(
                name=path.name,
                pool_contract=next(
                    i.stem for i in project._path.glob("contracts/testing/" + pool_impl)
                ),
            )


def pytest_generate_tests(metafunc):
    # Generate (multiple) parametrized calls to a test function
    project = get_loaded_projects()[0]
    if "pool_data" in metafunc.fixturenames:
        # parametrize `pool_data`
        pools = ["dai_pool", "usdc_pool", "eth_pool"]
        mainnet_eth_pools = [
            pool for pool in pools if _pooldata[pool]["underlying"] == ZERO_ADDRESS
        ]
        test_path = Path(metafunc.definition.fspath).relative_to(project._path)

        pool = metafunc.config.getoption("pool")
        if pool and not pool.endswith("_pool"):
            pool = pool + "_pool"
        poolType = metafunc.config.getoption("type")

        if test_path.parts[1] in ("common",):
            # Common tests
            if pool in pools:
                params = [pool]
            else:
                params = pools

            if poolType == "eth":
                params = mainnet_eth_pools
            elif poolType == "erc20":
                params = [pool for pool in pools if pool not in mainnet_eth_pools]

        elif test_path.parts[1] in ("eth"):
            # ETH specific tests
            params = mainnet_eth_pools
            if pool in mainnet_eth_pools:
                params = [pool]

        elif test_path.parts[1] in ("erc20"):
            # ERC20 specific tests
            params = [_pool for _pool in pools if _pool not in mainnet_eth_pools]
            if pool in params:
                params = [pool]

        else:
            if pool in pools:
                params = [pool]
            else:
                params = ["dai_pool"]  # default: target DAI pool

        for pool in params:
            if metafunc.config.getoption("strategy"):
                _pooldata[pool]["strategy"] = metafunc.config.getoption("strategy")

        metafunc.parametrize("pool_data", params, indirect=True, scope="session")


def pytest_ignore_collect(path, config):
    # Return True to prevent considering this path for collection
    project = get_loaded_projects()[0]
    path = Path(path).relative_to(project._path)
    path_parts = path.parts[1:-1]
    if path.is_dir():
        return None

    if path_parts == ():
        return None

    # always collect fixtures
    if path_parts[:1] == ("fixtures",):
        return None

    # don't run erc20 tests for eth pools
    if path_parts[:1] == ("erc20",):
        if config.getoption("type") == "eth":
            return True
        if config.getoption("pool"):
            pool = config.getoption("pool")
            if _pooldata[pool + "_pool"]["underlying"] == ZERO_ADDRESS:
                return True

    # don't run eth tests for erc20 pools
    if path_parts[:1] == ("eth",):
        if config.getoption("type") == "erc20":
            return True
        if config.getoption("pool"):
            pool = config.getoption("pool")
            if _pooldata[pool + "_pool"]["underlying"] != ZERO_ADDRESS:
                return True

    # always run common tests
    if path_parts[0] == "common":
        return None


def pytest_collection_modifyitems(config, items):
    for item in items.copy():
        # apply `skip_stateful` marker
        for marker in item.iter_markers(name="skip_stateful"):
            if config.getoption("skip_stateful"):
                items.remove(item)


@pytest.fixture(autouse=True, scope="session")
def set_priority_fee():
    priority_fee("0.5 gwei")


# main parametrized fixture, used to pass data about each pool into the other fixtures
@pytest.fixture(scope="module")
def pool_data(request):
    return _pooldata[request.param]


@pytest.fixture(scope="session")
def project():
    return get_loaded_projects()[0]


@pytest.fixture(scope="session")
def isForked():
    return "fork" in CONFIG.active_network["id"]


@pytest.fixture(autouse=True)
def isolation_setup(fn_isolation):
    pass


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line("markers", "skip_stateful: skip stateful test")
