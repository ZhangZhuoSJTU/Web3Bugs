from brownie.test.managers.runner import RevertContextManager as reverts
import pytest
from support.utils import scale


def test_update_required_staked_bkd_fails_without_bkd_locker(controller, admin):
    with reverts("address does not exist"):
        controller.prepareKeeperRequiredStakedBKD(scale(10), {"from": admin})


@pytest.mark.usefixtures("set_bkd_locker_to_mock_token")
def test_update_required_staked_bkd(controller, execute_with_delay):
    assert controller.getKeeperRequiredStakedBKD() == 0
    execute_with_delay(controller, "KeeperRequiredStakedBKD", scale(10))
    assert controller.getKeeperRequiredStakedBKD() == scale(10)


@pytest.mark.usefixtures("set_bkd_locker_to_mock_token")
def test_keeper_cannot_execute_action_without_tokens(
    controller, execute_with_delay, alice
):
    execute_with_delay(controller, "KeeperRequiredStakedBKD", scale(10))
    assert not controller.canKeeperExecuteAction(alice)


@pytest.mark.usefixtures("set_bkd_locker_to_mock_token")
def test_keeper_can_execute_action_with_tokens(
    controller, execute_with_delay, alice, mockToken
):
    execute_with_delay(controller, "KeeperRequiredStakedBKD", scale(10))
    mockToken.mintFor(alice, scale(10), {"from": alice})
    assert controller.canKeeperExecuteAction(alice)
