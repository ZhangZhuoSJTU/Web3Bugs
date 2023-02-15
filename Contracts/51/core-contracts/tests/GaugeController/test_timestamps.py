WEEK = 7 * 86400
YEAR = 365 * 86400


def test_timestamps(admin, chain, gauge_controller):
    assert gauge_controller.time_total() == (chain.time() + WEEK) // WEEK * WEEK
    for i in range(5):
        chain.sleep(int(1.1 * YEAR))
        tx = gauge_controller.checkpoint({"from": admin})
        assert gauge_controller.time_total() == (tx.timestamp + WEEK) // WEEK * WEEK
