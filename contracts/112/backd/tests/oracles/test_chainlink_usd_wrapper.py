import pytest
from support.utils import scale


@pytest.fixture(scope="module")
def wrapper(ChainlinkUsdWrapper, admin):
    return admin.deploy(ChainlinkUsdWrapper, "0x4e844125952d32acdf339be976c98e22f6f318db")


@pytest.mark.mainnetFork
def test_decimals(wrapper):
    assert wrapper.decimals() == 18


@pytest.mark.mainnetFork
def test_price(wrapper):
    price = wrapper.latestRoundData()[1]
    assert price > scale("0.1")
    assert price < scale("30")