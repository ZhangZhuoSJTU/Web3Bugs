import pytest


"""
To deploy a mock Compound environment you have to:
- deploy jump rate model and parameterize it
- deploy compotroller
- deploy cErc20 (can you initialize this?)
- call comptroller._supportMarket
"""


@pytest.fixture(scope="module", autouse=True)
def mockCToken(MockCToken, accounts):
    return accounts[0].deploy(MockCToken, 8)


@pytest.fixture(scope="module", autouse=True)
def aggregator(cTokenAggregator, mockCToken, accounts):
    return cTokenAggregator.deploy(mockCToken.address, {"from": accounts[0]})


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


def test_fetch_ctoken_rate(accounts, mockCToken, aggregator):
    mockCToken.setAnswer(1e18)
    rate1 = aggregator.getExchangeRateStateful().return_value
    rate2 = aggregator.getExchangeRateView()

    assert rate1 == 1e18
    assert rate2 == 1e18
