import pytest

TYPE_WEIGHTS = [5 * 10 ** 17, 2 * 10 ** 18]
GAUGE_WEIGHTS = [2 * 10 ** 18, 10 ** 18, 5 * 10 ** 17]


@pytest.fixture(scope="module", autouse=True)
def gauge_setup(gauge_controller, admin):
    gauge_controller.add_type(b"Liquidity", TYPE_WEIGHTS[0], {"from": admin})


@pytest.fixture(scope="module")
def gauge(three_gauges):
    return three_gauges[0]
