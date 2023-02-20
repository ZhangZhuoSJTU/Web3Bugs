import random

import pytest
from brownie.test import given, strategy
from tests.constants import SECONDS_IN_DAY, START_TIME

currencyId = 1
nextSettleTime = START_TIME - START_TIME % SECONDS_IN_DAY


@pytest.fixture(scope="module", autouse=True)
def mockAggregator(MockCToken, cTokenAggregator, accounts):
    mockToken = MockCToken.deploy(8, {"from": accounts[0]})
    mock = cTokenAggregator.deploy(mockToken.address, {"from": accounts[0]})
    # Set the settlement rate to be set
    mockToken.setAnswer(50e18)

    return mock


@pytest.fixture(scope="module", autouse=True)
def mockSettleAssets(MockSettleAssets, mockAggregator, accounts):
    contract = MockSettleAssets.deploy({"from": accounts[0]})

    # Set the mock aggregators
    contract.setMaxCurrencyId(1)
    contract.setAssetRateMapping(currencyId, (mockAggregator.address, 8))

    return contract


@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass


def get_indexes(value):
    bitsList = list("{:0256b}".format(int(value.hex(), 16)))
    return [i for (i, b) in enumerate(bitsList) if b == "1"]


@given(days=strategy("uint", min_value=1, max_value=90))
def test_shift_under_90_days(mockSettleAssets, accounts, days):
    maturity = nextSettleTime + days * SECONDS_IN_DAY

    mockSettleAssets.setifCash(accounts[0], currencyId, maturity, 100e8, nextSettleTime)
    # Ensure that no settlement actually occurs
    blockTime = random.randint(nextSettleTime, maturity - SECONDS_IN_DAY)

    before = mockSettleAssets.getifCashArray(accounts[0], currencyId, nextSettleTime)
    mockSettleAssets.settleAccount(accounts[0], currencyId, nextSettleTime, blockTime)
    after = mockSettleAssets.getifCashArray(accounts[0], currencyId, blockTime)

    assert before == after


@given(weeks=strategy("uint", min_value=91, max_value=135))
def test_shift_week_bits(mockSettleAssets, accounts, weeks):
    maturity = mockSettleAssets.getMaturityFromBitNum(nextSettleTime, weeks)

    mockSettleAssets.setifCash(accounts[0], currencyId, maturity, 100e8, nextSettleTime)
    # TODO: randomize less than before
    blockTime = random.randint(nextSettleTime, maturity - SECONDS_IN_DAY)

    before = mockSettleAssets.getifCashArray(accounts[0], currencyId, nextSettleTime)
    mockSettleAssets.settleAccount(accounts[0], currencyId, nextSettleTime, blockTime)
    after = mockSettleAssets.getifCashArray(accounts[0], currencyId, blockTime)

    assert before == after


@given(bits=strategy("uint", min_value=136, max_value=195))
def test_remap_month_bits_no_remap(mockSettleAssets, accounts, bits):
    maturity = mockSettleAssets.getMaturityFromBitNum(nextSettleTime, bits)

    mockSettleAssets.setifCash(accounts[0], currencyId, maturity, 100e8, nextSettleTime)
    # TODO: randomize less than before
    blockTime = random.randint(nextSettleTime, maturity - SECONDS_IN_DAY)

    before = mockSettleAssets.getifCashArray(accounts[0], currencyId, nextSettleTime)
    mockSettleAssets.settleAccount(accounts[0], currencyId, nextSettleTime, blockTime)
    after = mockSettleAssets.getifCashArray(accounts[0], currencyId, blockTime)

    assert before == after


@given(bits=strategy("uint", min_value=196, max_value=256))
def test_remap_quarter_bits_no_remap(mockSettleAssets, accounts, bits):
    maturity = mockSettleAssets.getMaturityFromBitNum(nextSettleTime, bits)

    mockSettleAssets.setifCash(accounts[0], currencyId, maturity, 100e8, nextSettleTime)
    # TODO: randomize less than before
    blockTime = random.randint(nextSettleTime, maturity - SECONDS_IN_DAY)

    before = mockSettleAssets.getifCashArray(accounts[0], currencyId, nextSettleTime)
    mockSettleAssets.settleAccount(accounts[0], currencyId, nextSettleTime, blockTime)
    after = mockSettleAssets.getifCashArray(accounts[0], currencyId, blockTime)

    assert before == after
