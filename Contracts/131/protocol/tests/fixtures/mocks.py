import pytest
import brownie

from brownie import ZERO_ADDRESS


@pytest.fixture(scope="module")
def curveLpToken(MockCurveToken, admin):
    return admin.deploy(MockCurveToken, 18)


@pytest.fixture(scope="module")
def curveMinter(MockMinter, admin, crv):
    return admin.deploy(MockMinter, crv)


@pytest.fixture(scope="module")
def curveSwap(MockCurveSwap, MockCurveSwapETH, curveLpToken, curveCoins, admin, coin):
    if coin == ZERO_ADDRESS:
        # use ETH/SETH Curve pool for tests
        return admin.deploy(MockCurveSwapETH, admin, curveCoins, curveLpToken,
                 600, 4000000, 5000000000)
    else:
        # use 3Pool for tests
        return admin.deploy(MockCurveSwap, admin, curveCoins, curveLpToken,
                 600, 4000000, 5000000000)


@pytest.fixture(scope="module")
def curveGauge(MockCurveGauge, curveLpToken, curveMinter, admin):
    return admin.deploy(MockCurveGauge, curveLpToken, curveMinter, admin)
