#!/usr/bin/python3

import pytest


@pytest.mark.parametrize("idx", range(5))
def test_initial_approval_is_zero(token, accounts, idx):
    assert token.allowance(accounts[0], accounts[idx]) == 0


def test_approve(token, accounts):
    token.approve(accounts[1], 10**19, {'from': accounts[0]})

    assert token.allowance(accounts[0], accounts[1]) == 10**19


# def test_modify_approve(token, accounts):
#     token.approve(accounts[1], 10**19, {'from': accounts[0]})
#     # token.approve(accounts[1], 12345678, {'from': accounts[0]})

#     assert token.allowance(accounts[0], accounts[1]) == 12345678


def test_revoke_approve(token, accounts):
    token.approve(accounts[1], 10**19, {'from': accounts[0]})
    token.approve(accounts[1], 0, {'from': accounts[0]})

    assert token.allowance(accounts[0], accounts[1]) == 0


def test_approve_self(token, accounts):
    token.approve(accounts[0], 10**19, {'from': accounts[0]})

    assert token.allowance(accounts[0], accounts[0]) == 10**19


def test_only_affects_target(token, accounts):
    token.approve(accounts[1], 10**19, {'from': accounts[0]})

    assert token.allowance(accounts[1], accounts[0]) == 0


def test_returns_true(token, accounts):
    tx = token.approve(accounts[1], 10**19, {'from': accounts[0]})

    assert tx.return_value is True


def test_approval_event_fires(accounts, token):
    tx = token.approve(accounts[1], 10**19, {'from': accounts[0]})

    assert len(tx.events) == 1
    assert tx.events["Approval"].values() == [accounts[0], accounts[1], 10**19]
