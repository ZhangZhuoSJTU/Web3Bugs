import brownie
import pytest
from support.constants import ADMIN_DELAY
from support.convert import format_to_bytes


def test_set_max_withdrawal_fee(admin, chain, pool):
    newFee = 0.05 * 1e18
    expected_key = format_to_bytes("MaxWithdrawalFee", 32, True)
    pool.setMinWithdrawalFee(0)
    pool.setMaxWithdrawalFee(0)

    tx = pool.prepareNewMaxWithdrawalFee(newFee, {"from": admin})
    assert tx.events["ConfigPreparedNumber"][0]["key"] == expected_key
    assert tx.events["ConfigPreparedNumber"][0]["value"] == newFee

    chain.sleep(ADMIN_DELAY)

    tx = pool.executeNewMaxWithdrawalFee()
    assert pool.getMaxWithdrawalFee() == newFee
    assert tx.events["ConfigUpdatedNumber"][0]["key"] == expected_key
    assert tx.events["ConfigUpdatedNumber"][0]["oldValue"] == 0
    assert tx.events["ConfigUpdatedNumber"][0]["newValue"] == newFee


@pytest.mark.parametrize("fee", [0.2, 0.5, 0.06, 1])
def test_fail_withdrawal_fee_too_high(admin, pool, fee):
    # dev: attempt to set withdrawal fee > 5%
    invalidFee = 1e18 * fee
    with brownie.reverts("invalid amount"):
        pool.prepareNewMaxWithdrawalFee(invalidFee, {"from": admin})
