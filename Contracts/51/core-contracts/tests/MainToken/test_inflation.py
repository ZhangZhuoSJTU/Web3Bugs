from brownie import chain, reverts
import pytest
from tests.conftest import EMISSIONS_IN_FIRST_EPOCH, INFLATION_DELAY, EPOCH, advance_epochs

# Boot Finance Token Emission Schedule
#
# https://docs.google.com/spreadsheets/d/16aZznOquMsZnx1nz31RQQ6gtMfxiiSuSrVDA19srbBs/edit?pli=1#gid=1421541501
#
# Copied here from the Token Emissions / Beginning Week one row past the corresponding year.
#
EMISSIONS_IN_YEAR = [
    (1,  95403138 * 0.125),  # beginning of 52nd week in year 1
    (5, 201482317 * 0.125),
    (6, 207618057 * 0.125),  # +3%
    (7, 213939118 * 0.125)   # +3%
]

SECONDS_IN_HOUR = 3600
SECONDS_IN_DAY = 86400
SECONDS_IN_WEEK = 7 * SECONDS_IN_DAY
SECONDS_IN_YEAR = 52 * SECONDS_IN_WEEK


def test_supply_after_first_week(boot):
    assert 0 == boot.available_supply()
    chain.sleep(EPOCH)
    boot.update_mining_parameters()
    qty = boot.available_supply() // 1e18
    assert_approximately_equal(qty, EMISSIONS_IN_FIRST_EPOCH)


def test_supply_after_random_implosion(boot):
    chain.sleep(SECONDS_IN_DAY)
    assert 0 == boot.mining_epoch()
    boot.start_epoch_time_write()
    with reverts():
        boot.update_mining_parameters()
    with reverts():
        boot.update_mining_parameters()
    chain.sleep(SECONDS_IN_DAY)
    assert 0 == boot.mining_epoch()
    boot.future_epoch_time_write()
    with reverts():
        boot.update_mining_parameters()
    chain.sleep(SECONDS_IN_DAY)
    assert 0 == boot.mining_epoch()
    boot.future_epoch_time_write()
    with reverts():
        boot.update_mining_parameters()
    chain.sleep(SECONDS_IN_DAY)
    assert 0 == boot.mining_epoch()
    boot.start_epoch_time_write()
    with reverts():
        boot.update_mining_parameters()
    chain.sleep(SECONDS_IN_DAY)
    assert 0 == boot.mining_epoch()
    boot.start_epoch_time_write()
    with reverts():
        boot.update_mining_parameters()
    chain.sleep(SECONDS_IN_DAY)
    assert 0 == boot.mining_epoch()
    boot.future_epoch_time_write()
    with reverts():
        boot.update_mining_parameters()
    chain.sleep(SECONDS_IN_DAY)
    assert 0 == boot.mining_epoch()
    boot.start_epoch_time_write()
    qty = boot.available_supply() // 1e18
    assert_approximately_equal(qty, EMISSIONS_IN_FIRST_EPOCH)


@pytest.mark.parametrize("year", range(4))
def test_supply_at_year_end(boot, year):
    advance_epochs(-1 + 52 * EMISSIONS_IN_YEAR[year][0], boot)
    qty = boot.available_supply() // 1e18
    assert_approximately_equal(qty, EMISSIONS_IN_YEAR[year][1], tolerance=100)


# Utilities
#
def assert_approximately_equal(a, b, tolerance=15):
    assert abs(a - b) < tolerance

