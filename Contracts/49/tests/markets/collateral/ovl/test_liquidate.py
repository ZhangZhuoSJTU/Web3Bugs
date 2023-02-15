import brownie
import pytest
from pytest import approx


def print_logs(tx):
    for i in range(len(tx.events['log'])):
        print(tx.events['log'][i]['k'] + ": " + str(tx.events['log'][i]['v']))


MIN_COLLATERAL = 1e14  # min amount to build
COLLATERAL = 10*1e18
TOKEN_DECIMALS = 18
TOKEN_TOTAL_SUPPLY = 8000000
OI_CAP = 800000e18
SLIPPAGE_TOL = 0.2

POSITIONS = [
    {
        "entry": {"timestamp": 1633520012, "price": 306204647441547},
        "liquidation": {"timestamp": 1633546772, "price": 318674244785741},
        "unliquidatable": {"timestamp": 1633520312, "price": 310411480531706},
        "collateral": COLLATERAL,
        "leverage": 10,
        "is_long": False,
    },
    {
        "entry": {"timestamp": 1633504052, "price": 319655307482755},
        "liquidation": {"timestamp": 1633512812, "price": 306336694541566},
        "unliquidatable": {"timestamp": 1633504232, "price": 315040205244259},
        "collateral": COLLATERAL,
        "leverage": 10,
        "is_long": True,
    },
]


def value(total_oi, total_oi_shares, pos_oi_shares, debt,
          price_frame, is_long):
    pos_oi = pos_oi_shares * total_oi / total_oi_shares

    if is_long:
        val = pos_oi * price_frame
        val -= min(val, debt)
    else:
        val = pos_oi * 2
        val -= min(val, debt + pos_oi * price_frame)

    return val


@pytest.mark.parametrize('position', POSITIONS)
def test_liquidate_success_zero_funding(
    mothership,
    feed_infos,
    ovl_collateral,
    token,
    market,
    alice,
    gov,
    bob,
    start_time,
    position,
):

    brownie.chain.mine(timestamp=start_time)

    market.setK(0, {'from': gov})

    margin_maintenance = ovl_collateral.marginMaintenance(market) / 1e18

    # Mine to the entry time then build
    brownie.chain.mine(timestamp=position["entry"]["timestamp"])
    tx_build = ovl_collateral.build(
        market,
        position['collateral'],
        position['leverage'],
        position['is_long'],
        position['collateral'] * position['leverage'] * (1-SLIPPAGE_TOL),
        {'from': bob}
    )
    pos_id = tx_build.events['Build']['positionId']
    (_, _, _, pos_price_idx, pos_oi_shares,
     pos_debt, pos_cost) = ovl_collateral.positions(pos_id)

    # mine a bit more then update to settle
    brownie.chain.mine(timedelta=10)
    market.update({"from": gov})
    entry_bid, entry_ask, entry_price = market.pricePoints(pos_price_idx)

    brownie.chain.mine(timestamp=position["liquidation"]["timestamp"])

    tx_liq = ovl_collateral.liquidate(pos_id, alice, {'from': alice})

    assert 'Liquidate' in tx_liq.events
    assert 'positionId' in tx_liq.events['Liquidate']
    assert tx_liq.events['Liquidate']['positionId'] == pos_id

    (_, _, _, _, pos_oi_shares_after, _, _) = ovl_collateral.positions(pos_id)

    assert pos_oi_shares_after == 0

    # Check the price we liquidated at ...
    liq_bid, liq_ask, liq_price = market.pricePoints(
        market.pricePointNextIndex() - 1)

    # calculate value and make sure it should have been liquidatable
    price_frame = liq_bid/entry_ask if position["is_long"] \
        else liq_ask/entry_bid
    expected_value = value(pos_oi_shares, pos_oi_shares, pos_oi_shares,
                           pos_debt, price_frame, position["is_long"])
    assert expected_value < pos_oi_shares * margin_maintenance


@pytest.mark.parametrize('position', POSITIONS)
def test_liquidate_revert_not_liquidatable(
    mothership,
    feed_infos,
    ovl_collateral,
    token,
    market,
    alice,
    gov,
    bob,
    rewards,
    start_time,
    position,
):

    brownie.chain.mine(timestamp=start_time)

    market.setK(0, {'from': gov})

    # Mine to the entry time then build
    brownie.chain.mine(timestamp=position["entry"]["timestamp"])
    tx_build = ovl_collateral.build(
        market,
        position['collateral'],
        position['leverage'],
        position['is_long'],
        position['collateral'] * position['leverage'] * (1-SLIPPAGE_TOL),
        {'from': bob}
    )
    pos_id = tx_build.events['Build']['positionId']
    (_, _, _, pos_price_idx, pos_oi_shares,
     pos_debt, pos_cost) = ovl_collateral.positions(pos_id)

    # mine a bit more then update to settle
    brownie.chain.mine(timedelta=10)
    market.update({"from": gov})
    entry_bid, entry_ask, entry_price = market.pricePoints(pos_price_idx)

    brownie.chain.mine(timestamp=position["unliquidatable"]["timestamp"])
    EXPECTED_ERROR_MESSAGE = "OVLV1:!liquidatable"
    with brownie.reverts(EXPECTED_ERROR_MESSAGE):
        ovl_collateral.liquidate(pos_id, alice, {'from': alice})

    brownie.chain.mine(timestamp=position["liquidation"]["timestamp"])

    ovl_collateral.liquidate(pos_id, alice, {'from': alice})

    (_, _, _, _, pos_oi_shares_after, _, _) = ovl_collateral.positions(pos_id)

    assert pos_oi_shares_after == 0

    EXPECTED_ERROR_MESSAGE = "OVLV1:liquidated"
    with brownie.reverts(EXPECTED_ERROR_MESSAGE):
        ovl_collateral.unwind(pos_id, pos_oi_shares, {"from": bob})


@pytest.mark.parametrize('position', POSITIONS)
def test_liquidate_revert_unwind_after_liquidation(
    mothership,
    feed_infos,
    ovl_collateral,
    token,
    market,
    alice,
    gov,
    bob,
    start_time,
    position,
):

    brownie.chain.mine(timestamp=start_time)

    market.setK(0, {'from': gov})

    # Mine to the entry time then build
    brownie.chain.mine(timestamp=position["entry"]["timestamp"])
    tx_build = ovl_collateral.build(
        market,
        position['collateral'],
        position['leverage'],
        position['is_long'],
        position['collateral'] * position['leverage'] * (1-SLIPPAGE_TOL),
        {'from': bob}
    )
    pos_id = tx_build.events['Build']['positionId']
    (_, _, _, pos_price_idx, pos_oi_shares,
     pos_debt, pos_cost) = ovl_collateral.positions(pos_id)

    # mine a bit more then update to settle
    brownie.chain.mine(timedelta=10)
    market.update({"from": gov})
    entry_bid, entry_ask, entry_price = market.pricePoints(pos_price_idx)

    brownie.chain.mine(timestamp=position["liquidation"]["timestamp"])

    ovl_collateral.liquidate(pos_id, alice, {'from': alice})

    (_, _, _, _, pos_oi_shares_after, _, _) = ovl_collateral.positions(pos_id)

    assert pos_oi_shares_after == 0

    EXPECTED_ERROR_MESSAGE = "OVLV1:liquidated"
    with brownie.reverts(EXPECTED_ERROR_MESSAGE):
        ovl_collateral.unwind(
            pos_id,
            pos_oi_shares,
            {"from": bob}
            )


@pytest.mark.parametrize('position', POSITIONS)
def test_liquidate_pnl_burned(
    mothership,
    feed_infos,
    ovl_collateral,
    token,
    market,
    alice,
    gov,
    bob,
    start_time,
    position,
):

    brownie.chain.mine(timestamp=start_time)

    market.setK(0, {'from': gov})

    # Mine to the entry time then build
    brownie.chain.mine(timestamp=position["entry"]["timestamp"])
    tx_build = ovl_collateral.build(
        market,
        position['collateral'],
        position['leverage'],
        position['is_long'],
        position['collateral'] * position['leverage'] * (1-SLIPPAGE_TOL),
        {'from': bob}
    )
    pos_id = tx_build.events['Build']['positionId']
    (_, _, _, pos_price_idx, pos_oi_shares,
     pos_debt, pos_cost) = ovl_collateral.positions(pos_id)

    # mine a bit more then update to settle
    brownie.chain.mine(timedelta=10)
    market.update({"from": gov})
    entry_bid, entry_ask, _ = market.pricePoints(pos_price_idx)

    brownie.chain.mine(timestamp=position["liquidation"]["timestamp"])
    tx_liq = ovl_collateral.liquidate(pos_id, alice, {'from': alice})

    # Check the price we liquidated at ...
    liq_bid, liq_ask, _ = market.pricePoints(
        market.pricePointNextIndex()-1)

    # calculate value and make sure it should have been liquidatable
    price_frame = liq_bid/entry_ask if position["is_long"] \
        else liq_ask/entry_bid
    expected_value = value(pos_oi_shares, pos_oi_shares, pos_oi_shares,
                           pos_debt, price_frame, position["is_long"])

    expected_burn = pos_cost - expected_value
    for _, v in enumerate(tx_liq.events['Transfer']):
        if v['to'] == '0x0000000000000000000000000000000000000000':
            act_burn = v['value']

    assert int(expected_burn) == approx(act_burn)


@pytest.mark.parametrize('position', POSITIONS)
def test_liquidate_oi_removed(
    mothership,
    feed_infos,
    ovl_collateral,
    token,
    market,
    alice,
    gov,
    bob,
    start_time,
    position,
):

    brownie.chain.mine(timestamp=start_time)

    market.setK(0, {'from': gov})

    # Mine to the entry time then build
    brownie.chain.mine(timestamp=position["entry"]["timestamp"])
    tx_build = ovl_collateral.build(
        market,
        position['collateral'],
        position['leverage'],
        position['is_long'],
        position['collateral'] * position['leverage'] * (1-SLIPPAGE_TOL),
        {'from': bob}
    )
    pos_id = tx_build.events['Build']['positionId']
    (_, _, _, pos_price_idx, pos_oi_shares,
     pos_debt, pos_cost) = ovl_collateral.positions(pos_id)

    oi_before = market.oiLong() if position["is_long"] else market.oiShort()
    assert oi_before == pos_oi_shares

    brownie.chain.mine(timestamp=position["liquidation"]["timestamp"])
    _ = ovl_collateral.liquidate(pos_id, alice, {'from': alice})

    oi_after = market.oiLong() if position["is_long"] else market.oiShort()
    assert oi_after == 0


@pytest.mark.parametrize('position', POSITIONS)
def test_liquidate_zero_value(
    mothership,
    feed_infos,
    ovl_collateral,
    token,
    market,
    alice,
    gov,
    bob,
    start_time,
    position,
):

    brownie.chain.mine(timestamp=start_time)

    market.setK(0, {'from': gov})

    # Mine to the entry time then build
    brownie.chain.mine(timestamp=position["entry"]["timestamp"])
    tx_build = ovl_collateral.build(
        market,
        position['collateral'],
        3*position['leverage'],  # 3x so it effectively turns negative
        position['is_long'],
        3*position['collateral'] * position['leverage'] * (1-SLIPPAGE_TOL),
        {'from': bob}
    )
    pos_id = tx_build.events['Build']['positionId']
    (_, _, _, pos_price_idx, pos_oi_shares,
     pos_debt, pos_cost) = ovl_collateral.positions(pos_id)

    oi_before = market.oiLong() if position["is_long"] else market.oiShort()
    assert oi_before == pos_oi_shares

    brownie.chain.mine(timestamp=position["liquidation"]["timestamp"])

    value_prior = ovl_collateral.value(pos_id)
    assert value_prior == 0

    tx_liq = ovl_collateral.liquidate(pos_id, alice, {'from': alice})

    oi_after = market.oiLong() if position["is_long"] else market.oiShort()
    assert oi_after == 0

    expected_burn = pos_cost
    for _, v in enumerate(tx_liq.events['Transfer']):
        if v['to'] == '0x0000000000000000000000000000000000000000':
            act_burn = v['value']

    assert int(expected_burn) == approx(act_burn)


@pytest.mark.parametrize('position', POSITIONS)
def test_liquidate_rewards_and_fees(
    mothership,
    feed_infos,
    ovl_collateral,
    token,
    market,
    alice,
    gov,
    bob,
    start_time,
    position,
):

    brownie.chain.mine(timestamp=start_time)

    market.setK(0, {'from': gov})

    margin_reward_rate = ovl_collateral.marginRewardRate(market) / 1e18

    # Mine to the entry time then build
    brownie.chain.mine(timestamp=position["entry"]["timestamp"])
    tx_build = ovl_collateral.build(
        market,
        position['collateral'],
        position['leverage'],
        position['is_long'],
        position['collateral'] * position['leverage'] * (1-SLIPPAGE_TOL),
        {'from': bob}
    )
    pos_id = tx_build.events['Build']['positionId']
    (_, _, _, pos_price_idx, pos_oi_shares,
     pos_debt, pos_cost) = ovl_collateral.positions(pos_id)

    liquidations_prior = ovl_collateral.liquidations()
    alice_balance_prior = token.balanceOf(alice)

    brownie.chain.mine(timestamp=position["liquidation"]["timestamp"])
    value_prior = ovl_collateral.value(pos_id)

    tx_liq = ovl_collateral.liquidate(pos_id, alice, {'from': alice})

    liquidations_post = ovl_collateral.liquidations()
    alice_balance_post = token.balanceOf(alice)

    to_rewards = alice_balance_post - alice_balance_prior
    exp_rewards = margin_reward_rate * value_prior

    assert int(exp_rewards) == approx(to_rewards)
    assert tx_liq.events['Liquidate']['reward'] == to_rewards
    assert tx_liq.events['Liquidate']['rewarded'] == alice

    to_liquidations = liquidations_post - liquidations_prior
    exp_liquidations = value_prior * (1-margin_reward_rate)

    assert int(exp_liquidations) == approx(to_liquidations)


@pytest.mark.parametrize('position', [POSITIONS[0]])
def test_liquidate_with_funding(
    mothership,
    feed_infos,
    ovl_collateral,
    token,
    market,
    alice,
    gov,
    bob,
    start_time,
    position,
):

    brownie.chain.mine(timestamp=start_time)

    margin_maintenance = ovl_collateral.marginMaintenance(market) / 1e18

    # Mine to the entry time then build
    brownie.chain.mine(timestamp=position["entry"]["timestamp"])
    tx_build = ovl_collateral.build(
        market,
        position['collateral'],
        position['leverage'],
        position['is_long'],
        position['collateral'] * position['leverage'] * (1-SLIPPAGE_TOL),
        {'from': bob}
    )
    pos_id = tx_build.events['Build']['positionId']
    (_, _, _, pos_price_idx, pos_oi_shares,
     pos_debt, pos_cost) = ovl_collateral.positions(pos_id)

    # build a position for alice that take up 1/2 the OI of bob
    ovl_collateral.build(
        market,
        int(position['collateral']/2.0),
        position['leverage'],
        not position['is_long'],
        int(position['collateral']/2.0)
        * position['leverage'] * (1-SLIPPAGE_TOL),
        {'from': alice}
    )
    brownie.chain.mine(timestamp=position["liquidation"]["timestamp"]-300)

    # get the pos value now ...
    pos_val = ovl_collateral.value(pos_id)
    _ = ovl_collateral.liquidate(pos_id, alice, {'from': alice})
    exit_bid, exit_ask, _ = market.pricePoints(
        market.pricePointNextIndex() - 1)
    assert pos_val < margin_maintenance * pos_oi_shares

    # check alice oi still there
    oi_long = market.oiLong()
    oi_short = market.oiShort()

    if position["is_long"]:
        assert exit_bid > position["liquidation"]["price"]
        assert oi_long == 0
        assert oi_short > 0
    else:
        assert exit_ask < position["liquidation"]["price"]
        assert oi_short == 0
        assert oi_long > 0
