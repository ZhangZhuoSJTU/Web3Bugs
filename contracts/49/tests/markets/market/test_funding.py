import brownie
from brownie import chain
from brownie.test import given, strategy
from pytest import approx


@given(
  compoundings=strategy('uint256', min_value=1, max_value=100),
  oi=strategy('uint256', min_value=1, max_value=10000),
  is_long=strategy('bool'))
def test_funding_total_imbalance(bob, market, oi, ovl_collateral, start_time,
                                 is_long, mothership, compoundings):

    brownie.chain.mine(timestamp=start_time)

    COMPOUND_PERIOD = market.compoundingPeriod()
    FEE = mothership.fee() / 1e18
    K = market.k() / 1e18

    oi *= 1e16

    expected_oi = (oi / 1e18) - ((oi / 1e18) * FEE)

    expected_funding_factor = (1 - (2 * K)) ** compoundings

    expected_oi_after_payment = expected_oi * expected_funding_factor

    expected_funding_payment = expected_oi - expected_oi_after_payment

    ovl_collateral.build(market, oi, 1, is_long, 0, {'from': bob})

    oi = (market.oiLong() if is_long else market.oiShort()) / 1e18

    assert oi == approx(expected_oi), 'queued oi different to expected'

    chain.mine(timedelta=COMPOUND_PERIOD * compoundings)

    tx_update = market.update({'from': bob})

    funding_payment = tx_update.events['FundingPaid']['fundingPaid'] / 1e18

    if is_long:
        funding_payment = -funding_payment

    assert expected_funding_payment == approx(
        funding_payment, rel=1e-04), 'funding payment different than expected'

    oi_after_payment = (
            market.oiLong() if is_long else market.oiShort()) / 1e18

    assert oi_after_payment == approx(
            expected_oi_after_payment, rel=1e-04), 'oi after funding payment different than expected'  # noqa: E501
