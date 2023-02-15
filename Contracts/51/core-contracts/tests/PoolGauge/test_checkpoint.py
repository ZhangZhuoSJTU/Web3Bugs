import brownie

YEAR = 86400 * 365


def test_user_checkpoint(alice, pool_gauge):
    pool_gauge.user_checkpoint(alice, {"from": alice})


def test_user_checkpoint_new_period(alice, chain, pool_gauge):
    pool_gauge.user_checkpoint(alice, {"from": alice})
    chain.sleep(int(YEAR * 1.1))
    pool_gauge.user_checkpoint(alice, {"from": alice})


def test_user_checkpoint_wrong_account(alice, chuck, pool_gauge):
    with brownie.reverts("dev: unauthorized"):
        pool_gauge.user_checkpoint(alice, {"from": chuck})
