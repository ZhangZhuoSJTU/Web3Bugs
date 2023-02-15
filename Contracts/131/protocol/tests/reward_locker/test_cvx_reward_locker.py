from brownie import ZERO_ADDRESS, Contract, chain
from support.convert import format_to_bytes
import pytest
import datetime

from support.mainnet_contracts import TokenAddresses


@pytest.fixture(scope="module")
def rewardsLocker(admin, address_provider, CvxCrvRewardsLocker):
    return admin.deploy(CvxCrvRewardsLocker, address_provider)


@pytest.fixture(scope="module")
def cvxCrvRewards(interface):
    return interface.IRewardStaking("0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e")


@pytest.fixture(scope="module")
def vlCvxLocker(interface, rewardsLocker):
    return interface.ICvxLocker(rewardsLocker.CVX_LOCKER())


@pytest.mark.mainnetFork
def test_lock_rewards(
    crv, cvx, admin, vlCvxLocker, alice, cvxCrvRewards, rewardsLocker
):
    crv.transfer(rewardsLocker, 1e18, {"from": alice})
    cvx.transfer(rewardsLocker, 1e18, {"from": alice})
    assert cvx.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.lockRewards()
    assert cvxCrvRewards.balanceOf(rewardsLocker) >= 1e18
    assert vlCvxLocker.lockedBalanceOf(rewardsLocker) == 1e18
    chain.sleep(7 * 86400)
    vlCvxLocker.checkpointEpoch({"from": admin})
    assert vlCvxLocker.balanceOf(rewardsLocker) == 1e18
    assert crv.balanceOf(rewardsLocker) == 0
    assert cvx.balanceOf(rewardsLocker) == 0


@pytest.mark.mainnetFork
def test_lock_rewards_only_crv(crv, cvxcrv, admin, cvxCrvRewards, rewardsLocker):
    crv.transfer(rewardsLocker, 1e18, {"from": admin})
    assert crv.balanceOf(rewardsLocker) == 1e18
    assert cvxcrv.balanceOf(rewardsLocker) == 0
    rewardsLocker.lockRewards()
    assert cvxCrvRewards.balanceOf(rewardsLocker) >= 1e18


@pytest.mark.mainnetFork
def test_lock_crv(crv, cvxcrv, cvxCrvRewards, alice, rewardsLocker):
    crv.transfer(rewardsLocker, 1e18, {"from": alice})
    assert crv.balanceOf(rewardsLocker) == 1e18
    assert cvxcrv.balanceOf(rewardsLocker) == 0
    rewardsLocker.lockCrv()
    assert cvxCrvRewards.balanceOf(rewardsLocker) >= 1e18


@pytest.mark.mainnetFork
def test_lock_no_crv(rewardsLocker, cvxCrvRewards):
    rewardsLocker.lockCrv()
    assert cvxCrvRewards.balanceOf(rewardsLocker) == 0


@pytest.mark.mainnetFork
def test_lock_cvx(cvx, vlCvxLocker, alice, rewardsLocker):
    cvx.transfer(rewardsLocker, 1e18, {"from": alice})
    assert cvx.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.lockCvx()
    assert vlCvxLocker.lockedBalanceOf(rewardsLocker) == 1e18


@pytest.mark.mainnetFork
def test_claim_rewards(cvx, cvxcrv, alice, rewardsLocker, vlCvxLocker, admin):
    cvx.transfer(rewardsLocker, 1e18, {"from": alice})
    assert cvx.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.lockCvx()
    assert vlCvxLocker.lockedBalanceOf(rewardsLocker) == 1e18
    chain.sleep(7 * 86400)
    vlCvxLocker.checkpointEpoch({"from": admin})

    rewards = cvxcrv.balanceOf(rewardsLocker)
    assert rewards == 0

    rewardsLocker.claimRewards(False)
    reward_data = vlCvxLocker.rewardData(TokenAddresses.CVX_CRV)
    if reward_data[1] > datetime.datetime.now().timestamp():
        assert cvxcrv.balanceOf(rewardsLocker) > 0


@pytest.mark.mainnetFork
def test_claim_rewards_stake_cvxcrv(
    cvx, alice, cvxCrvRewards, cvxcrv, rewardsLocker, vlCvxLocker, admin
):
    cvx.transfer(rewardsLocker, 1e18, {"from": alice})
    assert cvx.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.lockCvx()
    assert vlCvxLocker.lockedBalanceOf(rewardsLocker) == 1e18
    chain.sleep(7 * 86400)
    vlCvxLocker.checkpointEpoch({"from": admin})
    rewardsLocker.claimRewards(True)
    rewardsLocker.stakeCvxCrv()
    assert cvxcrv.balanceOf(rewardsLocker) == 0
    reward_data = vlCvxLocker.rewardData(TokenAddresses.CVX_CRV)
    if reward_data[1] > datetime.datetime.now().timestamp():
        assert cvxCrvRewards.balanceOf(rewardsLocker) > 0


@pytest.mark.mainnetFork
def test_stake_cvx_crv(cvxcrv, cvxCrvRewards, rewardsLocker, alice, admin):
    tx = rewardsLocker.stakeCvxCrv()
    assert tx.return_value == False
    cvxcrv.transfer(rewardsLocker, 1e18, {"from": alice})
    assert cvxcrv.balanceOf(rewardsLocker) == 1e18
    tx = rewardsLocker.stakeCvxCrv()
    assert tx.return_value
    assert cvxcrv.balanceOf(rewardsLocker) == 0
    assert cvxCrvRewards.balanceOf(rewardsLocker) == 1e18


@pytest.mark.mainnetFork
def test_set_withdrawal_flag(rewardsLocker, admin):
    rewardsLocker.setWithdrawalFlag({"from": admin})
    assert rewardsLocker.prepareWithdrawal()


@pytest.mark.mainnetFork
def test_reset_withdrawal_flag(rewardsLocker, admin):
    assert rewardsLocker.prepareWithdrawal() == False
    rewardsLocker.setWithdrawalFlag({"from": admin})
    assert rewardsLocker.prepareWithdrawal()
    rewardsLocker.resetWithdrawalFlag({"from": admin})
    assert rewardsLocker.prepareWithdrawal() == False


@pytest.mark.mainnetFork
def test_process_expired_locks(cvx, treasury, vlCvxLocker, alice, admin, rewardsLocker):
    cvx.transfer(rewardsLocker, 1e18, {"from": alice})
    assert cvx.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.lockCvx()
    assert vlCvxLocker.lockedBalanceOf(rewardsLocker) == 1e18
    chain.sleep(86400 * 7 * 17)
    assert cvx.balanceOf(treasury) == 0
    rewardsLocker.processExpiredLocks(False, {"from": admin})
    assert cvx.balanceOf(rewardsLocker) == 1e18


@pytest.mark.mainnetFork
def test_process_expired_locks_relock(
    cvx, vlCvxLocker, bob, treasury, admin, rewardsLocker
):
    cvx.transfer(rewardsLocker, 1e18, {"from": bob})
    assert cvx.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.lockCvx()
    assert vlCvxLocker.lockedBalanceOf(rewardsLocker) == 1e18
    chain.sleep(86400 * 7 * 18)
    tx = rewardsLocker.processExpiredLocks(True, {"from": admin})
    assert tx.events["Staked"]["_user"] == rewardsLocker
    assert tx.events["Staked"]["_paidAmount"] == 1e18
    assert tx.events["Staked"]["_lockedAmount"] == 1e18
    assert cvx.balanceOf(treasury) == 0
    chain.sleep(15 * 86400)
    vlCvxLocker.checkpointEpoch({"from": admin})
    assert vlCvxLocker.lockedBalanceOf(rewardsLocker) == 1e18
    assert vlCvxLocker.balanceOf(rewardsLocker) == 1e18


@pytest.mark.mainnetFork
def test_set_treasury(rewardsLocker, bob, admin):
    rewardsLocker.setTreasury(bob, {"from": admin})
    assert rewardsLocker.treasury() == bob


@pytest.mark.mainnetFork
def test_withdraw(cvx, admin, treasury, bob, rewardsLocker):
    cvx.transfer(rewardsLocker, 1e18, {"from": bob})
    assert cvx.balanceOf(treasury) == 0
    rewardsLocker.withdraw(cvx, 0.5 * 1e18, {"from": admin})
    assert cvx.balanceOf(treasury) == 0.5 * 1e18


@pytest.mark.mainnetFork
def test_withdraw_full_balance(cvx, admin, treasury, bob, rewardsLocker):
    cvx.transfer(rewardsLocker, 1e18, {"from": bob})
    assert cvx.balanceOf(treasury) == 0
    rewardsLocker.withdraw(cvx, {"from": admin})
    assert cvx.balanceOf(treasury) == 1e18


@pytest.mark.mainnetFork
def test_unstake_cvx_crv(cvxcrv, cvxCrvRewards, alice, rewardsLocker, admin):
    cvxcrv.transfer(rewardsLocker, 1e18, {"from": alice})
    assert cvxcrv.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.stakeCvxCrv()
    assert cvxcrv.balanceOf(rewardsLocker) == 0
    assert cvxCrvRewards.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.unstakeCvxCrv({"from": admin})
    assert cvxCrvRewards.balanceOf(rewardsLocker) == 0
    assert cvxcrv.balanceOf(rewardsLocker) == 1e18


@pytest.mark.mainnetFork
def test_withdraw_cvx_crv(cvxcrv, treasury, cvxCrvRewards, bob, rewardsLocker, admin):
    cvxcrv.transfer(rewardsLocker, 1e18, {"from": bob})
    assert cvxcrv.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.stakeCvxCrv()
    assert cvxCrvRewards.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.withdrawCvxCrv(0.5 * 1e18, {"from": admin})
    assert cvxcrv.balanceOf(treasury) == 0.5 * 1e18
    assert cvxCrvRewards.balanceOf(rewardsLocker) == 0.5 * 1e18
    rewardsLocker.withdrawCvxCrv(0.5 * 1e18, {"from": admin})
    assert cvxcrv.balanceOf(treasury) == 1e18
    assert cvxCrvRewards.balanceOf(rewardsLocker) == 0


@pytest.mark.mainnetFork
def test_unstake_and_withdraw_cvx_crv(
    cvxcrv, alice, cvxCrvRewards, rewardsLocker, treasury, admin
):
    cvxcrv.transfer(rewardsLocker, 1e18, {"from": alice})
    assert cvxcrv.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.stakeCvxCrv()
    assert cvxCrvRewards.balanceOf(rewardsLocker) == 1e18
    rewardsLocker.unstakeCvxCrv(True, {"from": admin})
    assert cvxCrvRewards.balanceOf(rewardsLocker) == 0
    assert cvxcrv.balanceOf(rewardsLocker) == 0
    assert cvxcrv.balanceOf(treasury) == 1e18


@pytest.mark.mainnetFork
def test_set_delegate(cvx, rewardsLocker, admin, interface, alice, bob, vlCvxLocker):
    cvx.transfer(rewardsLocker, 1e18, {"from": alice})
    rewardsLocker.lockRewards()
    assert vlCvxLocker.lockedBalanceOf(rewardsLocker) == 1e18
    chain.sleep(7 * 86400)
    vlCvxLocker.checkpointEpoch({"from": admin})
    rewardsLocker.setDelegate("0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446", bob)
    snapshot_delegate = interface.IDelegation(
        "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446"
    )
    id = format_to_bytes("cvx.eth", 32)
    assert snapshot_delegate.delegation(rewardsLocker, id) == bob


@pytest.mark.mainnetFork
def test_clear_delegate(cvx, rewardsLocker, interface, admin, bob, vlCvxLocker):
    cvx.transfer(rewardsLocker, 1e18, {"from": bob})
    rewardsLocker.lockRewards()
    assert vlCvxLocker.lockedBalanceOf(rewardsLocker) == 1e18
    chain.sleep(7 * 86400)
    vlCvxLocker.checkpointEpoch({"from": admin})
    rewardsLocker.setDelegate("0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446", bob)
    snapshot_delegate = interface.IDelegation(
        "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446"
    )
    id = format_to_bytes("cvx.eth", 32)
    assert snapshot_delegate.delegation(rewardsLocker, id) == bob
    rewardsLocker.clearDelegate(
        "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446", {"from": admin}
    )
    assert snapshot_delegate.delegation(rewardsLocker, id) == ZERO_ADDRESS
