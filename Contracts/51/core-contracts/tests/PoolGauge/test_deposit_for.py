import brownie


def test_deposit_for(admin, alice, pool_gauge, mock_lp_token):
    mock_lp_token.approve(pool_gauge, 2 ** 256 - 1, {"from": admin})
    balance = mock_lp_token.balanceOf(admin)
    pool_gauge.set_approve_deposit(admin, True, {"from": alice})
    pool_gauge.deposit(100000, alice, {"from": admin})

    assert mock_lp_token.balanceOf(pool_gauge) == 100000
    assert mock_lp_token.balanceOf(admin) == balance - 100000
    assert pool_gauge.totalSupply() == 100000
    assert pool_gauge.balanceOf(alice) == 100000


def test_set_approve_deposit_initial(admin, alice, pool_gauge):
    assert pool_gauge.approved_to_deposit(admin, alice) is False


def test_set_approve_deposit_true(admin, alice, pool_gauge):
    pool_gauge.set_approve_deposit(admin, True, {"from": alice})
    assert pool_gauge.approved_to_deposit(admin, alice) is True


def test_set_approve_deposit_false(admin, alice, pool_gauge):
    pool_gauge.set_approve_deposit(admin, False, {"from": alice})
    assert pool_gauge.approved_to_deposit(admin, alice) is False


def test_set_approve_deposit_toggle(admin, alice, pool_gauge):
    for value in [True, True, False, False, True, False, True]:
        pool_gauge.set_approve_deposit(admin, value, {"from": alice})
        assert pool_gauge.approved_to_deposit(admin, alice) is value


def test_not_approved(admin, alice, pool_gauge, mock_lp_token):
    mock_lp_token.approve(pool_gauge, 2 ** 256 - 1, {"from": admin})
    with brownie.reverts("Not approved"):
        pool_gauge.deposit(100000, alice, {"from": admin})
