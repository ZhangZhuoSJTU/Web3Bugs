TYPE_WEIGHTS = [5 * 10 ** 17, 2 * 10 ** 18]
GAUGE_WEIGHTS = [2 * 10 ** 18, 10 ** 18, 5 * 10 ** 17]


def test_total_weight(admin, gauge_controller, three_gauges):
    gauge_controller.add_gauge(three_gauges[0], 0, GAUGE_WEIGHTS[0], {"from": admin})

    assert gauge_controller.get_total_weight() == (GAUGE_WEIGHTS[0] * TYPE_WEIGHTS[0])


def test_change_type_weight(admin, gauge_controller, three_gauges):
    gauge_controller.add_gauge(three_gauges[0], 0, 10 ** 18, {"from": admin})

    gauge_controller.change_type_weight(0, 31337, {"from": admin})

    assert gauge_controller.get_total_weight() == 10 ** 18 * 31337


def test_change_gauge_weight(admin, gauge_controller, three_gauges):
    gauge_controller.add_gauge(three_gauges[0], 0, 10 ** 18, {"from": admin})

    gauge_controller.change_gauge_weight(three_gauges[0], 31337, {"from": admin})

    assert gauge_controller.get_total_weight() == TYPE_WEIGHTS[0] * 31337


def test_multiple(admin, gauge_controller, three_gauges):
    gauge_controller.add_type(b"Insurance", TYPE_WEIGHTS[1], {"from": admin})
    gauge_controller.add_gauge(three_gauges[0], 0, GAUGE_WEIGHTS[0], {"from": admin})
    gauge_controller.add_gauge(three_gauges[1], 0, GAUGE_WEIGHTS[1], {"from": admin})
    gauge_controller.add_gauge(three_gauges[2], 1, GAUGE_WEIGHTS[2], {"from": admin})

    expected = (
        (GAUGE_WEIGHTS[0] * TYPE_WEIGHTS[0])
        + (GAUGE_WEIGHTS[1] * TYPE_WEIGHTS[0])
        + (GAUGE_WEIGHTS[2] * TYPE_WEIGHTS[1])
    )

    assert gauge_controller.get_total_weight() == expected
