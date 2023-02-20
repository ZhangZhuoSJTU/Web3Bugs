from support.constants import ADMIN_DELAY


def test_prepare_and_execute_keeper_fee(topUpActionFeeHandler, chain, admin):
    assert topUpActionFeeHandler.getKeeperFeeFraction() == 0
    topUpActionFeeHandler.prepareKeeperFee(0.4 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    topUpActionFeeHandler.executeKeeperFee()
    assert topUpActionFeeHandler.getKeeperFeeFraction() == 0.4 * 1e18
