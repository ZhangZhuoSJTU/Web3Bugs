import brownie
import math

from decimal import Decimal
from brownie.test import given, strategy
from pytest import approx, mark


def print_logs(tx):
    for i in range(len(tx.events['log'])):
        print(tx.events['log'][i]['k'] + ": " + str(tx.events['log'][i]['v']))


MIN_COLLATERAL = 1e14  # min amount to build
TOKEN_DECIMALS = 18
TOKEN_TOTAL_SUPPLY = 8000000
OI_CAP = 800000e18
FEE_RESOLUTION = 1e18
SLIPPAGE_TOL = 0.2
LMBDA = 1
PRICES = [
    # {
    #     "entry": {
    #         "timestamp": 1633520012,
    #         "micro_price": 307964236479616,
    #         "macro_price": 308748518420310,
    #         "rtol": 1e-4,
    #     }
    # },
    # {
    #     "entry": {
    #         "timestamp": 1633504052,
    #         "micro_price": 317828920167667,
    #         "macro_price": 316765033525492,
    #         "rtol": 1e-4,
    #     }
    # },
    {
        "entry": {
            "timestamp": 1633554032,
            "micro_price": 326752400804053,
            "macro_price": 326749496496389,
            "rtol": 1e-4,
        }
    },
]


@given(
    collateral=strategy(
        'uint256',
        min_value=1e18,
        max_value=(OI_CAP - 1e4)/100),
    leverage=strategy(
        'uint8',
        min_value=1,
        max_value=100),
    is_long=strategy(
        'bool'))
def test_build_success_zero_impact(
    ovl_collateral,
    token,
    mothership,
    market,
    bob,
    start_time,
    collateral,
    leverage,
    is_long
):

    brownie.chain.mine(timestamp=start_time)

    oi = collateral * leverage
    trade_fee = oi * mothership.fee() / FEE_RESOLUTION

    # get prior state of collateral manager
    fee_bucket = ovl_collateral.fees()
    ovl_balance = token.balanceOf(ovl_collateral)

    # get prior state of market
    market_oi = market.oiLong() if is_long else market.oiShort()

    # approve collateral contract to spend bob's ovl to build position
    token.approve(ovl_collateral, collateral, {"from": bob})

    # build the position
    oi_adjusted_min = oi * (1-SLIPPAGE_TOL)
    tx = ovl_collateral.build(
        market, collateral, leverage, is_long, oi_adjusted_min, {"from": bob})

    assert 'Build' in tx.events
    assert 'positionId' in tx.events['Build']
    pid = tx.events['Build']['positionId']

    # fees should be sent to fee bucket in collateral manager
    assert int(fee_bucket + trade_fee) == approx(ovl_collateral.fees())

    # check collateral sent to collateral manager
    assert int(ovl_balance + collateral) \
        == approx(token.balanceOf(ovl_collateral))

    # check position token issued with correct oi shares
    collateral_adjusted = collateral - trade_fee
    oi_adjusted = collateral_adjusted * leverage
    assert approx(ovl_collateral.balanceOf(bob, pid)) == int(oi_adjusted)

    # check position attributes for PID
    (pos_market,
     pos_islong,
     pos_lev,
     pos_price_idx,
     pos_oishares,
     pos_debt,
     pos_cost) = ovl_collateral.positions(pid)

    assert pos_market == market
    assert pos_islong == is_long
    assert pos_lev == leverage
    assert pos_price_idx == market.pricePointNextIndex() - 1
    assert approx(pos_oishares) == int(oi_adjusted)
    assert approx(pos_debt) == int(oi_adjusted - collateral_adjusted)
    assert approx(pos_cost) == int(collateral_adjusted)

    # check oi has been added on the market for respective side of trade
    if is_long:
        assert int(market_oi + oi_adjusted) == approx(market.oiLong())
    else:
        assert int(market_oi + oi_adjusted) == approx(market.oiShort())


def test_build_when_market_not_supported(
    ovl_collateral,
    token,
    mothership,
    market,
    notamarket,
    bob,
    start_time,
    leverage=1,  # doesn't matter
    is_long=True  # doesn't matter
):

    brownie.chain.mine(timestamp=start_time)

    EXPECTED_ERROR_MESSAGE = 'OVLV1:!market'

    token.approve(ovl_collateral, 3e18, {"from": bob})
    # just to avoid failing min_collateral check because of fees
    trade_amt = MIN_COLLATERAL*2
    oi_adjusted_min = trade_amt * leverage * (1-SLIPPAGE_TOL)

    assert mothership.marketActive(market)
    assert not mothership.marketActive(notamarket)
    with brownie.reverts(EXPECTED_ERROR_MESSAGE):
        ovl_collateral.build(notamarket, trade_amt,
                             leverage, is_long, oi_adjusted_min, {'from': bob})


@given(
    leverage=strategy(
        'uint8',
        min_value=1,
        max_value=100),
    is_long=strategy(
        'bool'))
def test_build_min_collateral(
    ovl_collateral,
    token,
    mothership,
    market,
    bob,
    start_time,
    leverage,
    is_long
):

    brownie.chain.mine(timestamp=start_time)

    EXPECTED_ERROR_MESSAGE = 'OVLV1:collat<min'

    token.approve(ovl_collateral, 3e18, {"from": bob})

    # Here we compute exactly how much to trade in order to have just the
    # MIN_COLLATERAL after fees are taken
    # TODO: check this logic ...
    FL = mothership.fee()*leverage
    fee_offset = MIN_COLLATERAL*(FL/(FEE_RESOLUTION - FL))
    trade_amt = (MIN_COLLATERAL + fee_offset)
    oi_adjusted_min = trade_amt * leverage * (1-SLIPPAGE_TOL)

    # higher than min collateral passes
    tx = ovl_collateral.build(market, trade_amt + 1,
                              leverage, is_long, oi_adjusted_min,
                              {'from': bob})
    assert isinstance(tx, brownie.network.transaction.TransactionReceipt)

    # lower than min collateral fails
    with brownie.reverts(EXPECTED_ERROR_MESSAGE):
        ovl_collateral.build(market, trade_amt - 2,
                             leverage, is_long, oi_adjusted_min, {'from': bob})


def test_build_max_leverage(
    ovl_collateral,
    token,
    market,
    bob,
    start_time,
    collateral=1e18,
    is_long=True
):

    brownie.chain.mine(timestamp=start_time)

    EXPECTED_ERROR_MESSAGE = 'OVLV1:lev>max'

    token.approve(ovl_collateral, collateral, {"from": bob})
    # just to avoid failing min_collateral check because of fees
    trade_amt = MIN_COLLATERAL*2
    oi_adjusted_min = trade_amt * \
        ovl_collateral.maxLeverage(market) * (1-SLIPPAGE_TOL)

    tx = ovl_collateral.build(
        market, trade_amt, ovl_collateral.maxLeverage(market), is_long,
        oi_adjusted_min, {'from': bob})
    assert isinstance(tx, brownie.network.transaction.TransactionReceipt)

    with brownie.reverts(EXPECTED_ERROR_MESSAGE):
        ovl_collateral.build(market, trade_amt,
                             ovl_collateral.maxLeverage(market) + 1,
                             is_long, oi_adjusted_min, {'from': bob})


def test_build_cap(
    token,
    ovl_collateral,
    market,
    bob,
    start_time,
    leverage=1,
    is_long=True
):

    brownie.chain.mine(timestamp=start_time)

    # NOTE error msg should be 'OVLV1:collat>cap'
    EXPECTED_ERROR_MESSAGE = 'OVLV1:>cap'

    cap = market.oiCap()

    token.approve(ovl_collateral, cap*2, {"from": bob})

    oi_adjusted_min = cap * (1-SLIPPAGE_TOL)

    tx = ovl_collateral.build(market, cap, leverage, is_long,
                              oi_adjusted_min, {'from': bob})
    assert isinstance(tx, brownie.network.transaction.TransactionReceipt)

    with brownie.reverts(EXPECTED_ERROR_MESSAGE):
        ovl_collateral.build(market, cap + 1, leverage, is_long,
                             oi_adjusted_min, {"from": bob})


@given(
    collateral=strategy(
        'uint256',
        min_value=1e18,
        max_value=(OI_CAP - 1e4)/100),
    leverage=strategy(
        'uint8',
        min_value=1,
        max_value=100),
    is_long=strategy(
        'bool'))
def test_oi_added(
    ovl_collateral,
    token,
    mothership,
    market,
    bob,
    start_time,
    collateral,
    leverage,
    is_long
):

    brownie.chain.mine(timestamp=start_time)

    market_oi = market.oiLong() if is_long else market.oiShort()
    assert market_oi == 0

    oi_adjusted_min = collateral * leverage * (1-SLIPPAGE_TOL)

    token.approve(ovl_collateral, collateral, {"from": bob})
    ovl_collateral.build(
        market, collateral, leverage, is_long, oi_adjusted_min, {"from": bob})

    oi = collateral * leverage
    trade_fee = oi * mothership.fee() / FEE_RESOLUTION

    # added oi less fees should be taken from collateral
    collateral_adjusted = collateral - trade_fee
    oi_adjusted = collateral_adjusted * leverage

    new_market_oi = market.oiLong() if is_long else market.oiShort()
    assert approx(new_market_oi) == int(oi_adjusted)


@given(
    collateral=strategy(
        'uint256',
        min_value=1e18,
        max_value=(OI_CAP - 1e4)/3000),
    leverage=strategy(
        'uint8',
        min_value=1,
        max_value=100),
    multiplier=strategy(
        'decimal',
        min_value="1.01",
        max_value="14"),
    is_long=strategy(
        'bool'))
def test_oi_shares_onesided_zero_funding(
    ovl_collateral,
    token,
    mothership,
    market,
    gov,
    alice,
    bob,
    start_time,
    collateral,
    leverage,
    is_long,
    multiplier
):

    brownie.chain.mine(timestamp=start_time)

    # Set k to zero so test without worrying about funding rate
    market.setK(0, {'from': gov})
    multiplier = float(multiplier)

    oi_adjusted_min = collateral * leverage * (1-SLIPPAGE_TOL)

    # build multiple positions on a side
    _ = ovl_collateral.build(market, collateral, leverage,
                             is_long, oi_adjusted_min, {"from": alice})
    _ = ovl_collateral.build(market, int(multiplier*collateral), leverage,
                             is_long, oi_adjusted_min, {"from": bob})

    (market_oi_long, market_oi_short, market_oi_long_shares,
     market_oi_short_shares) = market.oi()

    collateral_adjusted = collateral - collateral * \
        leverage*mothership.fee()/FEE_RESOLUTION
    oi_adjusted = collateral_adjusted*leverage

    expected_total_oi = oi_adjusted + oi_adjusted*multiplier
    expected_total_oi_shares = oi_adjusted + oi_adjusted*multiplier

    if is_long:
        assert int(expected_total_oi) == approx(market_oi_long)
        assert 0 == market_oi_short
        assert int(expected_total_oi_shares) == approx(market_oi_long_shares)
        assert 0 == market_oi_short_shares
    else:
        assert 0 == market_oi_long
        assert int(expected_total_oi) == approx(market_oi_short)
        assert 0 == market_oi_long_shares
        assert int(expected_total_oi_shares) == approx(market_oi_short_shares)

    # TODO: check position oi shares


@given(
    collateral=strategy(
        'uint256',
        min_value=1e18,
        max_value=(OI_CAP - 1e4)/3000),
    leverage=strategy(
        'uint8',
        min_value=1,
        max_value=100),
    multiplier=strategy(
        'decimal',
        min_value="1.01",
        max_value="14"),
    is_long=strategy(
        'bool'))
def test_oi_shares_bothsides_zero_funding(
            ovl_collateral,
            token,
            mothership,
            market,
            gov,
            alice,
            bob,
            start_time,
            collateral,
            leverage,
            is_long,
            multiplier
        ):
    pass


@given(
    # bc we build multiple positions w leverage take care not to hit CAP
    collateral=strategy(
        'uint256',
        min_value=1e18,
        max_value=(OI_CAP - 1e4)/300),
    leverage=strategy(
        'uint8',
        min_value=1,
        max_value=100),
    is_long=strategy(
        'bool'))
@mark.parametrize('price', PRICES)
def test_entry_update_price_fetching(
    ovl_collateral,
    token,
    market,
    bob,
    start_time,
    collateral,
    leverage,
    is_long,
    price
):

    brownie.chain.mine(timestamp=start_time)

    token.approve(ovl_collateral, collateral*3, {"from": bob})

    market_idx = market.pricePointNextIndex()

    print("market_idx", market_idx)

    # Mine to the entry time then build
    brownie.chain.mine(timestamp=price["entry"]["timestamp"])

    oi_adjusted_min = collateral * leverage * (1-SLIPPAGE_TOL)
    _ = ovl_collateral.build(
        market, collateral, leverage, is_long, oi_adjusted_min, {"from": bob})
    idx1 = market.pricePointNextIndex() - 1
    assert market_idx == idx1

    entry_bid1, entry_ask1, _ = market.pricePoints(idx1)

    # make sure bid/ask calculated correctly
    spread = market.pbnj()/1e18
    bid = math.exp(-spread)*min(price["entry"]["micro_price"],
                                price["entry"]["macro_price"])
    ask = math.exp(spread) * max(price["entry"]["micro_price"],
                                 price["entry"]["macro_price"])
    assert bid == approx(entry_bid1, rel=price["entry"]["rtol"])
    assert ask == approx(entry_ask1, rel=price["entry"]["rtol"])

    brownie.chain.mine(timedelta=market.compoundingPeriod()+1)

    _ = ovl_collateral.build(
        market, collateral, leverage, is_long, oi_adjusted_min, {"from": bob})
    idx2 = market.pricePointNextIndex() - 1

    assert idx2 == idx1+1

    entry_bid2, entry_ask2, entry_price2 = market.pricePoints(idx2)
    assert entry_price2 != price["entry"]["macro_price"]


@given(
    # bc we build multiple positions w leverage take care not to hit CAP
    collateral=strategy(
        'uint256',
        min_value=1e18,
        max_value=(OI_CAP - 1e4)/300),
    leverage=strategy(
        'uint8',
        min_value=1,
        max_value=100),
    compoundings=strategy(
        'uint16',
        min_value=1,
        max_value=36),
    is_long=strategy(
        'bool'))
def test_entry_update_compounding_oi_onesided(
    ovl_collateral,
    token,
    market,
    mothership,
    bob,
    start_time,
    collateral,
    leverage,
    is_long,
    compoundings
):

    brownie.chain.mine(timestamp=start_time)

    token.approve(ovl_collateral, collateral*2, {"from": bob})

    oi_adjusted_min = collateral * leverage * (1-SLIPPAGE_TOL)
    _ = ovl_collateral.build(
        market, collateral, leverage, is_long, oi_adjusted_min, {"from": bob})

    _ = ovl_collateral.build(
        market, collateral, leverage, is_long, oi_adjusted_min, {"from": bob})
    oi2 = market.oiLong() if is_long else market.oiShort()

    oi = collateral * leverage
    trade_fee = oi * mothership.fee() / FEE_RESOLUTION

    collateral_adjusted = collateral - trade_fee
    oi_adjusted = collateral_adjusted * leverage
    assert approx(oi2) == int(2*oi_adjusted)

    brownie.chain.mine(timedelta=compoundings*market.compoundingPeriod()+1)
    _ = market.update({"from": bob})

    oi_after_funding = market.oiLong() if is_long else market.oiShort()

    k = market.k() / 1e18
    funding_factor = (1 - 2*k)**(compoundings)
    expected_oi = oi2 * funding_factor

    assert int(expected_oi) == approx(oi_after_funding)


@given(
    # bc we build multiple positions w leverage take care not to hit CAP
    collateral=strategy(
        'uint256',
        min_value=1e18,
        max_value=(OI_CAP - 1e4)/3000),
    leverage=strategy(
        'uint8',
        min_value=1,
        max_value=100),
    compoundings=strategy(
        'uint16',
        min_value=1,
        max_value=36),
    multiplier=strategy(
        'decimal',
        min_value="1.01",
        max_value="14"),
    is_long=strategy(
        'bool'))
def test_entry_update_compounding_oi_imbalance(
    ovl_collateral,
    token,
    market,
    mothership,
    alice,
    bob,
    start_time,
    collateral,
    leverage,
    is_long,
    compoundings,
    multiplier
):

    brownie.chain.mine(timestamp=start_time)

    # transfer alice some tokens first given the conftest
    token.transfer(alice, collateral, {"from": bob})

    token.approve(ovl_collateral, collateral, {"from": alice})
    token.approve(ovl_collateral, int(multiplier*collateral), {"from": bob})

    oi_adjusted_min = collateral * leverage * (1-SLIPPAGE_TOL)
    _ = ovl_collateral.build(
        market, collateral, leverage, not is_long,
        oi_adjusted_min, {"from": alice})
    _ = ovl_collateral.build(
        market, int(multiplier*collateral), leverage, is_long,
        oi_adjusted_min, {"from": bob})

    market_oi_long = market.oiLong()
    market_oi_short = market.oiShort()

    collateral_adjusted = collateral - collateral * \
        leverage*mothership.fee()/FEE_RESOLUTION
    oi_adjusted = collateral_adjusted*leverage

    multiplier = float(multiplier)

    if is_long:
        assert approx(market_oi_long) == int(multiplier*oi_adjusted)
        assert approx(market_oi_short) == int(oi_adjusted)
    else:
        assert approx(market_oi_long) == int(oi_adjusted)
        assert approx(market_oi_short) == int(multiplier*oi_adjusted)

    market_oi_imbalance = market_oi_long - market_oi_short

    brownie.chain.mine(timedelta=compoundings*market.compoundingPeriod()+1)
    _ = market.update({"from": bob})

    oi_long_after_funding = market.oiLong()
    oi_short_after_funding = market.oiShort()
    oi_imbalance_after_funding = oi_long_after_funding - oi_short_after_funding

    k = market.k() / 1e18
    funding_factor = (1 - 2*k)**(compoundings)
    expected_oi_imbalance = market_oi_imbalance * funding_factor

    assert int(expected_oi_imbalance) == approx(oi_imbalance_after_funding)
    assert int(market_oi_long + market_oi_short) == approx(
        oi_long_after_funding + oi_short_after_funding)

    total_oi = market_oi_long + market_oi_short
    expected_funder_oi = (total_oi + expected_oi_imbalance)/2
    expected_funded_oi = (total_oi - expected_oi_imbalance)/2

    if is_long:
        expected_oi_long = expected_funder_oi
        expected_oi_short = expected_funded_oi
    else:
        expected_oi_long = expected_funder_oi
        expected_oi_short = expected_funded_oi

    assert int(expected_oi_long) == approx(oi_long_after_funding)
    assert int(expected_oi_short) == approx(oi_short_after_funding)


@given(
    collateral=strategy(
        'uint256',
        min_value=1e18,
        max_value=(OI_CAP - 1e4)/3000),
    leverage=strategy(
        'uint8',
        min_value=1,
        max_value=100),
    multiplier=strategy(
        'decimal',
        min_value="1.01",
        max_value="14"),
    is_long=strategy(
        'bool'))
def test_oi_shares_bothsides_with_funding(
            ovl_collateral,
            token,
            mothership,
            market,
            alice,
            bob,
            start_time,
            collateral,
            leverage,
            is_long,
            multiplier
        ):
    pass


@given(
    oi=strategy('uint256', min_value=1, max_value=OI_CAP/1e16),
    leverage=strategy('uint8', min_value=1, max_value=100),
    is_long=strategy('bool'),
    lmbda=strategy('decimal', min_value="0.5", max_value="5.0"))
def test_build_w_impact(
        ovl_collateral,
        token,
        mothership,
        market,
        bob,
        gov,
        start_time,
        oi,
        leverage,
        is_long,
        lmbda
):

    brownie.chain.mine(timestamp=start_time)

    lmbda = float(lmbda)

    market.setComptrollerParams(
        lmbda*1e18,
        market.oiCap(),
        market.brrrrdExpected(),
        market.brrrrdWindowMacro(),
        market.brrrrdWindowMicro(),
        {'from': gov}
    )

    oi *= 1e16
    collateral = oi / leverage
    trade_fee = oi * mothership.fee() / FEE_RESOLUTION

    q = oi / market.oiCap()
    impact_fee = oi * (1 - math.exp(-lmbda * q))

    collateral_adjusted = collateral - impact_fee - trade_fee
    oi_adjusted = collateral_adjusted * leverage

    # get prior state of collateral manager
    ovl_balance = token.balanceOf(ovl_collateral)

    # get prior state of market
    market_oi = market.oiLong() if is_long else market.oiShort()
    market_oi_cap = market.oiCap()  # accounts for depth, brrrd, static

    # check no market pressure before builds
    assert market.pressure(is_long, 0, market.oiCap()) == 0

    # approve collateral contract to spend bob's ovl to build position
    token.approve(ovl_collateral, collateral, {"from": bob})

    # in case have large impact, make sure to check for revert
    oi_min_adjusted = 0
    if collateral_adjusted < MIN_COLLATERAL:
        EXPECTED_ERROR_MESSAGE = "OVLV1:collat<min"
        with brownie.reverts(EXPECTED_ERROR_MESSAGE):
            ovl_collateral.build(market, collateral, leverage, is_long,
                                 oi_min_adjusted, {"from": bob})
        return
    # and if dynamic cap has brought down oi cap from static value
    elif oi_adjusted > market_oi_cap:
        EXPECTED_ERROR_MESSAGE = "OVLV1:>cap"
        with brownie.reverts(EXPECTED_ERROR_MESSAGE):
            ovl_collateral.build(market, collateral, leverage, is_long,
                                 oi_min_adjusted, {"from": bob})
        return

    # build the position
    tx = ovl_collateral.build(market, collateral, leverage, is_long,
                              oi_min_adjusted, {"from": bob})
    pid = tx.events['Build']['positionId']

    # check collateral sent to collateral manager
    assert int(ovl_balance + collateral - impact_fee) \
        == approx(token.balanceOf(ovl_collateral))

    # check position token issued with correct oi shares
    assert approx(ovl_collateral.balanceOf(bob, pid)) == int(oi_adjusted)

    # check position attributes for PID
    (pos_market,
     pos_islong,
     pos_lev,
     pos_price_idx,
     pos_oishares,
     pos_debt,
     pos_cost) = ovl_collateral.positions(pid)

    assert pos_market == market
    assert pos_islong == is_long
    assert pos_lev == leverage
    assert pos_price_idx == market.pricePointNextIndex() - 1
    assert approx(pos_oishares) == int(oi_adjusted)
    assert approx(pos_debt) == int(oi_adjusted - collateral_adjusted)
    assert approx(pos_cost) == int(collateral_adjusted)

    # check oi has been added on the market for respective side of trade
    if is_long:
        assert int(market_oi + oi_adjusted) == approx(market.oiLong())
    else:
        assert int(market_oi + oi_adjusted) == approx(market.oiShort())

    # check impact was burned
    act_impact_fee = 0
    for _, v in enumerate(tx.events['Transfer']):
        if v['to'] == '0x0000000000000000000000000000000000000000':
            act_impact_fee = v['value']

    assert int(impact_fee) == approx(act_impact_fee, rel=1e-04)

    # check new state of market pressure
    act_pressure = market.pressure(is_long, 0, market.oiCap())
    assert int(q*1e18) == approx(act_pressure, rel=1e-04)


@given(
    oi=strategy('uint256', min_value=1, max_value=OI_CAP/1e16),
    leverage=strategy('uint8', min_value=1, max_value=100),
    is_long=strategy('bool'),
    lmbda=strategy('decimal', min_value="0.5", max_value="5.0"))
def test_build_oi_adjusted_min(
        ovl_collateral,
        token,
        mothership,
        market,
        bob,
        gov,
        start_time,
        oi,
        leverage,
        is_long,
        lmbda
):

    brownie.chain.mine(timestamp=start_time)

    lmbda = float(lmbda)

    market.setComptrollerParams(
        lmbda*1e18,
        market.oiCap(),
        market.brrrrdExpected(),
        market.brrrrdWindowMacro(),
        market.brrrrdWindowMicro(),
        {'from': gov}
    )

    oi *= 1e16
    collateral = oi / leverage
    trade_fee = oi * mothership.fee() / FEE_RESOLUTION

    q = oi / market.oiCap()
    impact_fee = oi * (1 - math.exp(-lmbda * q))

    collateral_adjusted = collateral - impact_fee - trade_fee
    oi_adjusted = collateral_adjusted * leverage

    market_oi_cap = market.oiCap()  # accounts for depth, brrrd, static

    # approve collateral contract to spend bob's ovl to build position
    token.approve(ovl_collateral, collateral, {"from": bob})

    # in case have large impact, make sure to check for revert
    if collateral_adjusted < MIN_COLLATERAL:
        EXPECTED_ERROR_MESSAGE = "OVLV1:collat<min"
        with brownie.reverts(EXPECTED_ERROR_MESSAGE):
            ovl_collateral.build(market, collateral, leverage, is_long,
                                 0, {"from": bob})
        return
    # and if dynamic cap has brought down oi cap from static value
    elif oi_adjusted > market_oi_cap:
        EXPECTED_ERROR_MESSAGE = "OVLV1:>cap"
        with brownie.reverts(EXPECTED_ERROR_MESSAGE):
            ovl_collateral.build(market, collateral, leverage, is_long,
                                 0, {"from": bob})
        return

    # build the position with oi_adjusted * (1 + rtol) as min so fails
    r_tol = 1e-04
    oi_min_adjusted = int(oi_adjusted * (1 + r_tol))

    EXPECTED_ERROR_MESSAGE = "OVLV1:oi<min"
    with brownie.reverts(EXPECTED_ERROR_MESSAGE):
        ovl_collateral.build(market, collateral, leverage, is_long,
                             oi_min_adjusted, {"from": bob})

    # and now build successfully when immediately at oi_adjusted as min
    oi_min_adjusted = int(oi_adjusted * (1 - r_tol))
    tx = ovl_collateral.build(market, collateral, leverage, is_long,
                              oi_min_adjusted, {"from": bob})
    pid = tx.events['Build']['positionId']

    # check position token issued with correct oi shares
    assert approx(ovl_collateral.balanceOf(bob, pid)) == int(oi_adjusted)


@given(
    oi=strategy('uint256', min_value=1, max_value=OI_CAP/(100e16)),
    leverage=strategy('uint8', min_value=1, max_value=100),
    is_long=strategy('bool'),
    lmbda=strategy('decimal', min_value="0.5", max_value="5.0"),
    num_builds=strategy('uint8', min_value=2, max_value=10))
def test_build_multiple_in_one_impact_window(
        ovl_collateral,
        token,
        mothership,
        market,
        bob,
        gov,
        start_time,
        oi,
        leverage,
        is_long,
        lmbda,
        num_builds
):

    brownie.chain.mine(timestamp=start_time)

    lmbda = float(lmbda)

    market.setComptrollerParams(
        lmbda*1e18,
        market.oiCap(),
        market.brrrrdExpected(),
        market.brrrrdWindowMacro(),
        market.brrrrdWindowMicro(),
        {'from': gov}
    )

    oi *= 1e16
    collateral = oi / leverage
    trade_fee = oi * mothership.fee() / FEE_RESOLUTION

    # check no market pressure before builds
    assert market.pressure(is_long, 0, market.oiCap()) == 0

    # approve collateral contract to spend bob's ovl to build positions
    token.approve(
        ovl_collateral,
        int(Decimal(str(collateral)))*num_builds,
        {"from": bob})

    q = 0
    for i in range(num_builds):
        brownie.chain.mine(timedelta=1)

        market_oi = market.oiLong() if is_long else market.oiShort()
        market_oi_cap = market.oiCap()  # accounts for depth, brrrd, static

        q += oi / market_oi_cap
        impact_fee = oi * (1 - math.exp(-lmbda * q))

        proj_pressure = market.pressure(is_long, oi, market_oi_cap)
        proj_impact = market.impact(is_long, oi, market_oi_cap)

        assert int(q*1e18) == approx(proj_pressure, rel=1e-04)
        assert int(impact_fee) == approx(proj_impact, rel=1e-04)

        collateral_adjusted = collateral - impact_fee - trade_fee
        oi_adjusted = collateral_adjusted * leverage

        # get prior state of collateral manager
        ovl_balance = token.balanceOf(ovl_collateral)

        # get prior state of market

        # in case have large impact, make sure to check for revert
        oi_min_adjusted = 0
        if collateral_adjusted < MIN_COLLATERAL:
            EXPECTED_ERROR_MESSAGE = "OVLV1:collat<min"
            with brownie.reverts(EXPECTED_ERROR_MESSAGE):
                ovl_collateral.build(market, collateral, leverage, is_long,
                                     oi_min_adjusted, {"from": bob})
            break
        # and if dynamic cap has brought down oi cap from static value
        elif oi_adjusted > market_oi_cap:
            EXPECTED_ERROR_MESSAGE = "OVLV1:>cap"
            with brownie.reverts(EXPECTED_ERROR_MESSAGE):
                ovl_collateral.build(market, collateral, leverage, is_long,
                                     oi_min_adjusted, {"from": bob})
            break

        # build the position
        tx = ovl_collateral.build(market, collateral, leverage, is_long,
                                  oi_min_adjusted, {"from": bob})
        pid = tx.events['Build']['positionId']

        # check collateral sent to collateral manager
        assert int(ovl_balance + collateral - impact_fee) \
            == approx(token.balanceOf(ovl_collateral))

        # check position token issued with correct oi shares
        assert approx(ovl_collateral.balanceOf(bob, pid)) == int(oi_adjusted)

        # check position attributes for PID
        (pos_market,
         pos_islong,
         pos_lev,
         pos_price_idx,
         pos_oishares,
         pos_debt,
         pos_cost) = ovl_collateral.positions(pid)

        assert pos_market == market
        assert pos_islong == is_long
        assert pos_lev == leverage
        assert pos_price_idx == market.pricePointNextIndex() - 1
        assert approx(pos_oishares) == int(oi_adjusted)
        assert approx(pos_debt) == int(oi_adjusted - collateral_adjusted)
        assert approx(pos_cost) == int(collateral_adjusted)

        # check oi has been added on the market for respective side of trade
        if is_long:
            assert int(market_oi + oi_adjusted) == approx(market.oiLong())
        else:
            assert int(market_oi + oi_adjusted) == approx(market.oiShort())

        # check impact was burned
        act_impact_fee = 0
        for _, v in enumerate(tx.events['Transfer']):
            if v['to'] == '0x0000000000000000000000000000000000000000':
                act_impact_fee = v['value']

        assert int(impact_fee) == approx(act_impact_fee, rel=1e-04)

        # check new state of market pressure
        act_pressure = market.pressure(is_long, 0, market.oiCap())
        assert int(q*1e18) == approx(act_pressure, rel=1e-04)

        # for precision issues, set q to act_pressure for next loop
        q = act_pressure / (1e18)

    # check q => 0 after a window has passed
    brownie.chain.mine(timedelta=market.impactWindow()+1)
    assert market.pressure(is_long, 0, market.oiCap()) == 0


@given(
    oi=strategy('uint256', min_value=1, max_value=OI_CAP/(1000e16)),
    leverage=strategy('uint8', min_value=1, max_value=100),
    is_long=strategy('bool'),
    lmbda=strategy('decimal', min_value="0.5", max_value="5.0"),
    num_builds=strategy('uint8', min_value=4, max_value=10))
def test_build_multiple_in_multiple_impact_windows(
        ovl_collateral,
        token,
        mothership,
        market,
        bob,
        gov,
        start_time,
        oi,
        leverage,
        is_long,
        lmbda,
        num_builds
):

    brownie.chain.mine(timestamp=start_time)

    lmbda = float(lmbda)
    impact_window = market.impactWindow()
    impact_time_delta = 2 * int(impact_window / num_builds)

    market.setComptrollerParams(
        lmbda*1e18,
        market.oiCap(),
        market.brrrrdExpected(),
        market.brrrrdWindowMacro(),
        market.brrrrdWindowMicro(),
        {'from': gov}
    )

    oi *= 1e16
    collateral = oi / leverage
    trade_fee = oi * mothership.fee() / FEE_RESOLUTION

    # check no market pressure before builds
    assert market.pressure(is_long, 0, market.oiCap()) == 0

    # approve collateral contract to spend bob's ovl to build positions
    token.approve(
        ovl_collateral,
        int(Decimal(str(collateral)))*num_builds,
        {"from": bob})

    q = 0
    build_times = []
    qs = []

    build_time = brownie.chain.time()
    for i in range(num_builds):
        build_time += impact_time_delta + 1
        build_times.append(build_time)

        brownie.chain.mine(timestamp=build_time)

        q += oi / market.oiCap()
        qs.append(q)

        # find the index of build time one impact window behind last
        build_time_now = build_times[-1]
        build_time_then = build_time_now - impact_window
        build_time_then_idx = None
        for j in range(1, len(build_times)):
            bt = build_times[-j-1]
            if bt < build_time_then:
                build_time_then_idx = -j-1
                break

        pressure = qs[-1] - qs[build_time_then_idx] if build_time_then_idx \
            else qs[-1]

        impact_fee = oi * (1 - math.exp(-lmbda * pressure))

        proj_pressure = market.pressure(is_long, oi, market.oiCap())
        proj_impact = market.impact(is_long, oi, market.oiCap())

        assert int(pressure*1e18) == approx(proj_pressure, rel=1e-04)
        assert int(impact_fee) == approx(proj_impact, rel=1e-04)

        collateral_adjusted = collateral - impact_fee - trade_fee
        oi_adjusted = collateral_adjusted * leverage

        # get prior state of collateral manager
        ovl_balance = token.balanceOf(ovl_collateral)

        # get prior state of market
        market_oi = market.oiLong() if is_long else market.oiShort()
        market_oi_cap = market.oiCap()  # accounts for depth, brrrd, static

        # in case have large impact, make sure to check for revert
        oi_min_adjusted = 0
        if collateral_adjusted < MIN_COLLATERAL:
            EXPECTED_ERROR_MESSAGE = "OVLV1:collat<min"
            with brownie.reverts(EXPECTED_ERROR_MESSAGE):
                ovl_collateral.build(market, collateral, leverage, is_long,
                                     oi_min_adjusted, {"from": bob})
            break
        # and if dynamic cap has brought down oi cap from static value
        elif oi_adjusted > market_oi_cap:
            EXPECTED_ERROR_MESSAGE = "OVLV1:>cap"
            with brownie.reverts(EXPECTED_ERROR_MESSAGE):
                ovl_collateral.build(market, collateral, leverage, is_long,
                                     oi_min_adjusted, {"from": bob})
            break

        # build the position
        tx = ovl_collateral.build(market, collateral, leverage, is_long,
                                  oi_min_adjusted, {"from": bob})
        pid = tx.events['Build']['positionId']

        # check collateral sent to collateral manager
        assert int(ovl_balance + collateral - impact_fee) \
            == approx(token.balanceOf(ovl_collateral))

        # check position token issued with correct oi shares
        assert approx(ovl_collateral.balanceOf(bob, pid)) == int(oi_adjusted)

        # check position attributes for PID
        (pos_market,
         pos_islong,
         pos_lev,
         pos_price_idx,
         pos_oishares,
         pos_debt,
         pos_cost) = ovl_collateral.positions(pid)

        assert pos_market == market
        assert pos_islong == is_long
        assert pos_lev == leverage
        assert pos_price_idx == market.pricePointNextIndex() - 1
        assert approx(pos_oishares) == int(oi_adjusted)
        assert approx(pos_debt) == int(oi_adjusted - collateral_adjusted)
        assert approx(pos_cost) == int(collateral_adjusted)

        # check oi has been added on the market for respective side of trade
        if is_long:
            assert int(market_oi + oi_adjusted) == approx(market.oiLong())
        else:
            assert int(market_oi + oi_adjusted) == approx(market.oiShort())

        # check impact was burned
        act_impact_fee = 0
        for _, v in enumerate(tx.events['Transfer']):
            if v['to'] == '0x0000000000000000000000000000000000000000':
                act_impact_fee = v['value']

        assert int(impact_fee) == approx(act_impact_fee, rel=1e-04)

        # check new state of market pressure
        act_pressure = market.pressure(is_long, 0, market.oiCap())
        assert int(pressure*1e18) == approx(act_pressure, rel=1e-04)

        # for precision issues, adjust q for act_pressure to start next loop
        q = q - pressure + act_pressure / (1e18)

    # check q => 0 after a full window has passed
    brownie.chain.mine(timedelta=market.impactWindow()+1)
    assert market.pressure(is_long, 0, market.oiCap()) == 0


# TODO: def test_build_w_dyanmic_cap ? lmbda=strategy('decimal',
# min_value="0.2", max_value="0.5")
