def print_logs(tx):
    for i in range(len(tx.events['log'])):
        print(tx.events['log'][i]['k'] + ": " + str(tx.events['log'][i]['v']))


def test_set_static_cap(market, gov):
    # test updating _staticCap only in setComptrollerParams func
    input_static_cap = int(800000 * 1e19)

    initial_lmbda = market.lmbda()
    initial_brrrr_expected = market.brrrrdExpected()
    initial_brrrr_window_macro = market.brrrrdWindowMacro()
    initial_brrrr_window_micro = market.brrrrdWindowMicro()

    market.setComptrollerParams(
      initial_lmbda,
      input_static_cap,
      initial_brrrr_expected,
      initial_brrrr_window_macro,
      initial_brrrr_window_micro,
      {"from": gov}
    )

    current_static_cap = market.oiCap()

    current_lmbda = market.lmbda()
    current_brrrr_expected = market.brrrrdExpected()
    current_brrrr_window_macro = market.brrrrdWindowMacro()
    current_brrrr_window_micro = market.brrrrdWindowMicro()

    # test current static cap equals input value
    assert int(current_static_cap) == int(input_static_cap)

    # test other params are unchanged
    assert int(current_lmbda) == int(initial_lmbda)
    assert int(current_brrrr_expected) == int(initial_brrrr_expected)
    assert int(current_brrrr_window_macro) == int(initial_brrrr_window_macro)
    assert int(current_brrrr_window_micro) == int(initial_brrrr_window_micro)


def test_brrrr_fade(market, gov):
    # test updating _brrrrFade only in setComptrollerParams func
    input_brrrr_expected = 1e19

    initial_static_cap = market.oiCap()
    initial_lmbda = market.lmbda()
    initial_brrrr_window_macro = market.brrrrdWindowMacro()
    initial_brrrr_window_micro = market.brrrrdWindowMicro()

    market.setComptrollerParams(
      initial_lmbda,
      initial_static_cap,
      input_brrrr_expected,
      initial_brrrr_window_macro,
      initial_brrrr_window_micro,
      {"from": gov}
    )

    current_static_cap = market.oiCap()
    current_lmbda = market.lmbda()
    current_brrrr_expected = market.brrrrdExpected()
    current_brrrr_window_macro = market.brrrrdWindowMacro()
    current_brrrr_window_micro = market.brrrrdWindowMicro()

    # test current _brrrrFade equals input value
    assert int(current_brrrr_expected) == int(input_brrrr_expected)

    # test other params are unchanged
    assert int(current_static_cap) == int(initial_static_cap)
    assert int(current_lmbda) == int(initial_lmbda)
    assert int(current_brrrr_window_macro) == int(initial_brrrr_window_macro)
    assert int(current_brrrr_window_micro) == int(initial_brrrr_window_micro)


def test_set_comptroller_params(market, gov):
    # set all params of setComptrollerParams func
    input_static_cap = int(800000 * 1e19)
    input_lmbda = market.lmbda()
    input_brrrr_expected = 1e19
    input_brrrr_window_macro = 500
    input_brrrr_window_micro = 500

    market.setComptrollerParams(
      input_lmbda,
      input_static_cap,
      input_brrrr_expected,
      input_brrrr_window_macro,
      input_brrrr_window_micro,
      {"from": gov}
    )

    current_static_cap = market.oiCap()
    current_lmbda = market.lmbda()
    current_brrrr_expected = market.brrrrdExpected()
    current_brrrr_window_macro = market.brrrrdWindowMacro()
    current_brrrr_window_micro = market.brrrrdWindowMicro()

    # test all variables updated
    assert int(current_static_cap) == int(input_static_cap)
    assert int(current_lmbda) == int(input_lmbda)
    assert int(current_brrrr_expected) == int(input_brrrr_expected)
    assert int(current_brrrr_window_macro) == int(input_brrrr_window_macro)
    assert int(current_brrrr_window_micro) == int(input_brrrr_window_micro)


def test_set_compounding_period(market, gov):

    input_compounding_period = 660

    # grab initial _compoundingPeriod
    initial_compounding_period = market.compoundingPeriod()

    assert int(initial_compounding_period) != int(input_compounding_period)

    # set _compoundingPeriod
    market.setPeriods(input_compounding_period, {"from": gov})

    # grab current _compoundingPeriod
    current_compounding_period = market.compoundingPeriod()

    # test _compoundingPeriod updated to input value
    assert int(current_compounding_period) == int(input_compounding_period)


def test_set_k(market, gov):

    input_k = 346888760971066

    # TODO: test for different k values via an adjust
    # grab current t0 = k value
    initial_k_value = market.k()  # noqa: F841

    # update _k value
    market.setK(input_k, {"from": gov})

    # grab updated k value
    updated_k_value = market.k()

    # test if updated k value equals new k value
    assert int(updated_k_value) == int(input_k)


def test_set_spread(market, gov):
    # test for when spread value is updated
    input_spread = .00573e19

    # grab initial spread value
    initial_spread = market.pbnj()

    assert int(initial_spread) != int(input_spread)

    # set new spread value
    market.setSpread(input_spread, {"from": gov})

    # grab current spread value
    current_spread = market.pbnj()

    # test current spread equals updated input value
    assert int(current_spread) == int(input_spread)


def test_set_everything(market, gov):
    # pass in inputs into setEverything function
    input_k = 346888760971066
    input_spread = .00573e19
    input_compounding_period = 660
    input_static_cap = int(800000 * 1e19)
    input_brrrr_expected = 1e19
    input_brrrr_window_macro = 6000
    input_brrrr_window_micro = 6666

    input_lmbda = .5e18

    market.setEverything(
      input_k,
      input_spread,
      input_compounding_period,
      input_lmbda,
      input_static_cap,
      input_brrrr_expected,
      input_brrrr_window_macro,
      input_brrrr_window_micro,
      {"from": gov}
    )

    # grab all current variables
    current_k = market.k()
    current_spread = market.pbnj()
    current_compounding_period = market.compoundingPeriod()
    current_lmbda = market.lmbda()
    # TODO: current_static_cap assertion
    #  current_static_cap = market.oiCap()
    current_brrrr_expected = market.brrrrdExpected()
    current_brrrr_window_macro = market.brrrrdWindowMacro()
    current_brrrr_window_micro = market.brrrrdWindowMicro()

    # test all current values to be updated
    assert int(current_k) == int(input_k)

    assert int(current_spread) == int(input_spread)

    assert int(current_compounding_period) == int(input_compounding_period)

    assert int(current_lmbda) == int(input_lmbda)

    # TODO: how to test this part - needs fixing
    # assert int(current_static_cap) == int(input_static_cap)

    assert int(current_brrrr_expected) == int(input_brrrr_expected)

    assert int(current_brrrr_window_macro) == int(input_brrrr_window_macro)

    assert int(current_brrrr_window_micro) == int(input_brrrr_window_micro)
