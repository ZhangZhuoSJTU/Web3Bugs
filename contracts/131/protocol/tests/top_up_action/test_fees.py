import brownie

from support.constants import ADMIN_DELAY


def test_prepare_and_execute_action_fee(topUpAction, chain, admin):
    assert topUpAction.getActionFee() == 0
    topUpAction.prepareActionFee(0.01 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY)
    topUpAction.executeActionFee()
    assert topUpAction.getActionFee() == 0.01 * 1e18


def test_revert_prepared_action_fee(topUpAction, admin):
    assert topUpAction.getActionFee() == 0
    topUpAction.prepareActionFee(0.01 * 1e18, {"from": admin})
    topUpAction.resetActionFee({"from": admin})
    with brownie.reverts():
        topUpAction.resetActionFee()
    assert topUpAction.getActionFee() == 0


def test_fail_execute_before_deadline_action_fee(topUpAction, chain, admin):
    assert topUpAction.getActionFee() == 0
    topUpAction.prepareActionFee(0.01 * 1e18, {"from": admin})
    chain.sleep(ADMIN_DELAY - 100)
    with brownie.reverts():
        topUpAction.executeActionFee()
    assert topUpAction.getActionFee() == 0


def test_fail_execute_if_not_prepared_action_fee(topUpAction, admin):
    with brownie.reverts():
        topUpAction.executeActionFee()
