import brownie
from brownie.test import given, strategy
from hypothesis import settings, strategies
from brownie import chain
from pytest import approx

FEE_RESOLUTION = 1e18
MIN_COLLATERAL = 1e14  # min amount to build
COLLATERAL = 10*1e18
TOKEN_DECIMALS = 18
TOKEN_TOTAL_SUPPLY = 8000000
OI_CAP = 800000e18
SLIPPAGE_TOL = 0.2


def print_logs(tx):
    for i in range(len(tx.events['log'])):
        print(tx.events['log'][i]['k'] + ": " + str(tx.events['log'][i]['v']))


def get_collateral(collateral, leverage, fee):
    FL = fee*leverage
    fee_offset = MIN_COLLATERAL*(FL/(FEE_RESOLUTION - FL))
    if collateral - fee_offset <= MIN_COLLATERAL:
        return int(MIN_COLLATERAL + fee_offset)
    else:
        return int(collateral)


def test_unwind(ovl_collateral, token, bob):
    pass


def test_unwind_revert_insufficient_shares(
    ovl_collateral,
    bob,
    start_time
):

    brownie.chain.mine(timestamp=start_time)

    EXPECTED_ERROR_MESSAGE = "OVLV1:!shares"
    with brownie.reverts(EXPECTED_ERROR_MESSAGE):
        ovl_collateral.unwind(
            1,
            1e18,
            {"from": bob}
        )


@given(
    is_long=strategy('bool'),
    oi=strategy('uint256', min_value=1, max_value=OI_CAP/1e16),
    leverage=strategy('uint256', min_value=1, max_value=100))
@settings(max_examples=50)
def test_unwind_oi_removed(
        ovl_collateral,
        mothership,
        market,
        token,
        bob,
        alice,
        start_time,
        oi,
        leverage,
        is_long):

    brownie.chain.mine(timestamp=start_time)

    # Build parameters
    oi *= 1e16
    collateral = get_collateral(oi / leverage, leverage, mothership.fee())

    # Build
    token.approve(ovl_collateral, collateral, {"from": bob})
    tx_build = ovl_collateral.build(
        market,
        collateral,
        leverage,
        is_long,
        collateral * leverage * (1-SLIPPAGE_TOL),
        {"from": bob}
    )

    # Position info
    pid = tx_build.events['Build']['positionId']
    poi_build = tx_build.events['Build']['oi']

    (_, _, _, price_point, oi_shares_build,
        debt_build, cost_build) = ovl_collateral.positions(pid)

    # TODO: When this changed to compoundingPeriod - 10 there was a problem.
    # Why?
    chain.mine(timedelta=100)

    assert oi_shares_build > 0
    assert poi_build > 0

    # Unwind
    tx_unwind = ovl_collateral.unwind(
        pid,
        oi_shares_build,
        {"from": bob}
    )

    (_, _, _, _, oi_shares_unwind, _, _) = ovl_collateral.positions(pid)

    poi_unwind = tx_unwind.events['Unwind']['oi']

    viewedOi = market.oiLong() if is_long else market.oiShort()

    assert oi_shares_unwind == 0
    assert poi_unwind / 1e18 == approx(poi_build / 1e18)
    assert viewedOi / 1e18 == approx(0)


@given(
    is_long=strategy('bool'),
    oi=strategy('uint256', min_value=1, max_value=OI_CAP/1e16),
    leverage=strategy('uint256', min_value=1, max_value=100),
    time_delta=strategies.floats(min_value=0.1, max_value=1),
)
def test_unwind_expected_fee(
    ovl_collateral,
    mothership,
    market,
    token,
    bob,
    start_time,
    feed_infos,
    oi,
    leverage,
    is_long,
    time_delta
):

    brownie.chain.mine(timestamp=start_time)

    mine_ix = int(
        (len(feed_infos.market_info[2]['timestamp']) - 1) * time_delta)

    mine_time = feed_infos.market_info[2]['timestamp'][mine_ix]

    oi *= 1e16

    collateral = get_collateral(oi / leverage, leverage, mothership.fee())

    token.approve(ovl_collateral, collateral, {"from": bob})

    tx_build = ovl_collateral.build(
        market,
        collateral,
        leverage,
        is_long,
        collateral * leverage * (1-SLIPPAGE_TOL),
        {"from": bob}
    )

    price_cap = market.priceFrameCap() / 1e18

    fees_prior = ovl_collateral.fees() / 1e18

    # Position info
    pid = tx_build.events['Build']['positionId']
    (_, _, _, price_point, oi_shares_pos,
     debt_pos, _) = ovl_collateral.positions(pid)

    bob_balance = ovl_collateral.balanceOf(bob, pid)

    chain.mine(timestamp=mine_time+1)

    (oi, oi_shares, price_frame) = market.positionInfo(is_long, price_point)

    exit_index = market.pricePointNextIndex()

    ovl_collateral.unwind(
        pid,
        bob_balance,
        {"from": bob}
    )

    price_entry = market.pricePoints(price_point)
    entry_bid = price_entry[0]
    entry_ask = price_entry[1]

    price_exit = market.pricePoints(exit_index)
    exit_bid = price_exit[0]
    exit_ask = price_exit[1]

    price_frame = min(exit_bid / entry_ask,
                      price_cap) if is_long else exit_ask / entry_bid

    oi /= 1e18
    debt_pos /= 1e18
    oi_shares /= 1e18
    oi_shares_pos /= 1e18

    # Fee calculation
    pos_oi = (oi_shares_pos * oi) / oi_shares

    if is_long:
        val = pos_oi * price_frame
        val = val - min(val, debt_pos)
    else:
        val = pos_oi * 2
        val = val - min(val, debt_pos + pos_oi * price_frame)

    notional = val + debt_pos

    fee = notional * (mothership.fee() / 1e18)

    fees_now = ovl_collateral.fees() / 1e18

    assert fee + fees_prior == approx(fees_now), "fees not expected amount"


@given(
    is_long=strategy('bool'),
    bob_oi=strategy('uint256', min_value=1, max_value=OI_CAP/1e16),
    alice_oi=strategy('uint256', min_value=3, max_value=OI_CAP/1e16),
    leverage=strategy('uint256', min_value=1, max_value=100))
def test_partial_unwind(
  ovl_collateral,
  mothership,
  market,
  token,
  bob,
  alice,
  start_time,
  bob_oi,
  alice_oi,
  leverage,
  is_long
):

    brownie.chain.mine(timestamp=start_time)

    # Build parameters
    bob_oi *= 1e16
    alice_oi *= 1e16

    if bob_oi + alice_oi > OI_CAP:
        reduction = OI_CAP / (bob_oi + alice_oi)
        bob_oi *= reduction
        alice_oi *= reduction

    fee = mothership.fee()

    bob_collateral = get_collateral(bob_oi / leverage, leverage, fee)
    alice_collateral = get_collateral(alice_oi / leverage, leverage, fee)

    # Alice and Bob both builds a position
    token.approve(ovl_collateral, bob_collateral, {"from": bob})
    token.approve(ovl_collateral, alice_collateral, {"from": alice})

    bob_tx_build = ovl_collateral.build(
        market,
        bob_collateral,
        leverage,
        is_long,
        bob_collateral * leverage * (1-SLIPPAGE_TOL),
        {"from": bob}
    )

    # Update period so Alice and Bob do not share same positionId
    chain.mine(timedelta=15)

    alice_tx_build = ovl_collateral.build(
        market,
        alice_collateral,
        leverage,
        is_long,
        alice_collateral * leverage * (1-SLIPPAGE_TOL),
        {"from": alice}
    )

    # Position info
    bob_pid = bob_tx_build.events['Build']['positionId']
    bob_poi_build = bob_tx_build.events['Build']['oi']

    alice_pid = alice_tx_build.events['Build']['positionId']
    alice_poi_build = alice_tx_build.events['Build']['oi']

    (_, _, _, _, bob_oi_shares_build, _, _) = ovl_collateral.positions(bob_pid)

    (_, _, _, _, alice_oi_shares_build, _, _) = ovl_collateral.positions(alice_pid)  # noqa: E501

    chain.mine(timedelta=15)

    # Confirm that Bob and Alice both hold a position
    assert bob_oi_shares_build > 0
    assert bob_poi_build > 0

    assert alice_oi_shares_build > 0
    assert alice_poi_build > 0

    # Unwind half of OI
    bob_unwind_shares = bob_poi_build / 2

    ovl_collateral.unwind(bob_pid, bob_unwind_shares, {"from": bob})

    bob_oi_shares_after_unwind = ovl_collateral.positions(bob_pid)['oiShares']
    alice_oi_shares_after_unwind = ovl_collateral.positions(alice_pid)[
                                                            'oiShares']

    # Confirm Bob still hold a position after partial unwind
    assert bob_oi_shares_build > 0
    assert bob_poi_build > 0

    assert alice_oi_shares_after_unwind == alice_oi_shares_build
    assert alice_poi_build > 0

    # Bob should contain proper amounts of OI remaining
    assert bob_oi_shares_after_unwind == bob_poi_build - bob_unwind_shares

    # Total OI should be accurate including Alice's position
    total_oi = market.oiLong() if is_long else market.oiShort()

    assert total_oi / \
        1e18 == approx(
            (bob_poi_build - bob_unwind_shares + alice_poi_build)/1e18)


@given(
    is_long=strategy('bool'),
    oi=strategy('uint256', min_value=1, max_value=OI_CAP/1e16),
    leverage=strategy('uint256', min_value=1, max_value=100))
def test_unwind_after_transfer(
    ovl_collateral,
    mothership,
    market,
    token,
    bob,
    alice,
    start_time,
    oi,
    leverage,
    is_long
):

    brownie.chain.mine(timestamp=start_time)

    # Build parameters
    oi *= 1e16
    collateral = get_collateral(oi / leverage, leverage, mothership.fee())

    # Bob builds a position
    token.approve(ovl_collateral, collateral, {"from": bob})
    tx_build = ovl_collateral.build(
        market,
        collateral,
        leverage,
        is_long,
        collateral * leverage * (1-SLIPPAGE_TOL),
        {"from": bob}
    )

    # Position info
    pid = tx_build.events['Build']['positionId']
    pos_oi_build = tx_build.events['Build']['oi']

    (_, _, _, price_point, oi_shares_build, debt_build,
     cost_build) = ovl_collateral.positions(pid)

    chain.mine(timedelta=market.compoundingPeriod()+1)

    # Confirm that Bob holds a position
    assert oi_shares_build > 0
    assert pos_oi_build > 0

    # Transfer Bob's position to Alice
    ovl_collateral.safeTransferFrom(
        bob, alice, pid, ovl_collateral.totalSupply(pid), 1, {"from": bob})

    # Bob's unwind attempt should fail
    EXPECTED_ERROR_MESSAGE = "OVLV1:!shares"
    with brownie.reverts(EXPECTED_ERROR_MESSAGE):
        ovl_collateral.unwind(
            pid,
            oi_shares_build,
            {"from": bob}
        )


@given(
    is_long=strategy('bool'),
    oi=strategy('uint256', min_value=1, max_value=OI_CAP/1e16),
    leverage=strategy('uint256', min_value=1, max_value=100))
def test_comptroller_recorded_mint_or_burn(
    ovl_collateral,
    token,
    market,
    bob,
    is_long,
    start_time,
    oi,
    leverage,
    mothership
):
    '''
    When we unwind we want to see that the comptroller included however much
    was minted or burnt from the payout from unwinding the position into its
    brrrrd storage variable.
    '''

    pass
    # TODO: needs updating to new comptroller


@given(
    is_long=strategy('bool'),
    oi=strategy('uint256', min_value=1, max_value=OI_CAP/1e16),
    leverage=strategy('uint256', min_value=1, max_value=100),
    time_delta=strategies.floats(min_value=0.1, max_value=1),)
def test_unwind_pnl_mint_burn(
    ovl_collateral,
    token,
    market,
    bob,
    feed_infos,
    mothership,
    start_time,
    is_long,
    time_delta,
    leverage,
    oi
):
    '''
    Check if whatever was minted/burnt is equal to the PnL
    '''

    brownie.chain.mine(timestamp=start_time)

    price_cap = market.priceFrameCap() / 1e18

    # mine_time parameter to test over multiple time frames
    mine_ix = int(
        (len(feed_infos.market_info[2]['timestamp']) - 1) * time_delta)
    mine_time = feed_infos.market_info[2]['timestamp'][mine_ix]

    oi *= 1e16
    collateral = get_collateral(oi / leverage, leverage, mothership.fee())

    token.approve(ovl_collateral, 1e50, {'from': bob})

    # Build position
    tx_build = ovl_collateral.build(
        market,
        collateral,
        leverage,
        is_long,
        collateral * leverage * (1-SLIPPAGE_TOL),
        {"from": bob}
    )

    chain.mine(timestamp=mine_time+1)

    # Build position info
    pid = tx_build.events['Build']['positionId']
    tx_build.events['Build']['oi']
    (_, _, _, price_point, oi_shares_pos, debt_pos,
     cost_pos) = ovl_collateral.positions(pid)

    bob_balance = ovl_collateral.balanceOf(bob, pid)

    total_pos_shares = ovl_collateral.totalSupply(pid)

    (oi, oi_shares, price_frame) = market.positionInfo(is_long, price_point)

    # Unwind position

    exit_price_ix = market.pricePointNextIndex()

    tx_unwind = ovl_collateral.unwind(
        pid,
        bob_balance,
        {"from": bob}
    )

    # Fee calculation
    price_entry = market.pricePoints(price_point)
    entry_bid = price_entry[0]
    entry_ask = price_entry[1]

    price_exit = market.pricePoints(exit_price_ix)
    exit_bid = price_exit[0]
    exit_ask = price_exit[1]

    price_frame = min(exit_bid / entry_ask,
                      price_cap) if is_long else exit_ask / entry_bid

    oi_pos = (oi_shares_pos * oi) / oi_shares

    if is_long:
        val = oi_pos * price_frame
        val = val - min(val, debt_pos)
    else:
        val = oi_pos * 2
        val = val - min(val, debt_pos + oi_pos * price_frame)

    notional = val + debt_pos

    fee = notional * (mothership.fee() / 1e18)

    # Other metrics
    debt = bob_balance * (debt_pos/total_pos_shares)
    cost = bob_balance * (cost_pos/total_pos_shares)

    value_adjusted = notional - fee

    value_adjusted = value_adjusted - debt if value_adjusted > debt else 0

    exp_pnl = value_adjusted - cost

    for _, v in enumerate(tx_unwind.events['Transfer']):
        if v['to'] == '0x0000000000000000000000000000000000000000':
            act_pnl = -v['value']
        elif v['from'] == '0x0000000000000000000000000000000000000000':
            act_pnl = v['value']

    assert exp_pnl == approx(act_pnl)
