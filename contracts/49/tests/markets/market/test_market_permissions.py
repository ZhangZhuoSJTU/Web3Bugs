import brownie


def print_logs(tx):
    for i in range(len(tx.events['log'])):
        print(tx.events['log'][i]['k'] + ": " + str(tx.events['log'][i]['v']))


def test_only_gov_can_update_market(market, token, bob, alice, rewards, feed_owner, fees,  # noqa: E501
                                    comptroller):
    # ensure only gov can update market
    # mock inputs below
    input_k = 346888760971066
    input_spread = .00573e19
    input_compounding_period = 660
    input_static_cap = int(800000 * 1e19)
    input_brrrr_expected = 1e19
    input_brrrr_window_macro = 1e19
    input_brrrr_window_micro = 1e19
    initial_lmbda = market.lmbda()

    EXPECTED_ERROR_MSG = 'OVLV1:!governor'

    with brownie.reverts(EXPECTED_ERROR_MSG):
        market.setComptrollerParams(
            initial_lmbda,
            input_static_cap,
            input_brrrr_expected,
            input_brrrr_window_macro,
            input_brrrr_window_micro,
            {"from": alice})

    with brownie.reverts(EXPECTED_ERROR_MSG):
        market.setPeriods(
            input_compounding_period,
            {"from": bob})

    with brownie.reverts(EXPECTED_ERROR_MSG):
        market.setK(
            input_k,
            {"from": feed_owner})

    with brownie.reverts(EXPECTED_ERROR_MSG):
        market.setSpread(
            input_spread,
            {"from": fees})

    with brownie.reverts(EXPECTED_ERROR_MSG):
        market.setEverything(
            input_k,
            input_spread,
            input_compounding_period,
            input_static_cap,
            initial_lmbda,
            input_brrrr_expected,
            input_brrrr_window_macro,
            input_brrrr_window_micro,
            {"from": token})
