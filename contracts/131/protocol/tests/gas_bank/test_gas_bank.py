from brownie.test.managers.runner import RevertContextManager as reverts

from support.utils import scale


def test_deposit_for(gas_bank, alice, bob):
    tx = gas_bank.depositFor(bob, {"from": alice, "value": scale(5)})
    assert tx.events["Deposit"]["account"] == bob
    assert tx.events["Deposit"]["value"] == scale(5)
    assert gas_bank.balance() == scale(5)
    assert gas_bank.balanceOf(bob) == scale(5)


def test_withdraw_from_self_no_locked(gas_bank, alice, bob):
    gas_bank.depositFor(bob, {"from": alice, "value": scale(5)})
    bob_eth = bob.balance()
    tx = gas_bank.withdrawFrom(bob, scale(5), {"from": bob})
    assert tx.events["Withdraw"]["account"] == bob
    assert tx.events["Withdraw"]["receiver"] == bob
    assert tx.events["Withdraw"]["value"] == scale(5)
    assert bob.balance() == bob_eth + scale(5) - tx.gas_used * tx.gas_price
    assert gas_bank.balanceOf(bob) == 0


def test_withdraw_from_self_locked(gas_bank, alice, bob, mockAction):
    gas_bank.depositFor(bob, {"from": alice, "value": scale(5)})
    mockAction.setEthRequiredForGas(bob, scale(4))
    tx = gas_bank.withdrawFrom(bob, scale(1), {"from": bob})
    assert tx.events["Withdraw"]["account"] == bob
    assert tx.events["Withdraw"]["receiver"] == bob
    assert tx.events["Withdraw"]["value"] == scale(1)
    assert gas_bank.balanceOf(bob) == scale(4)


def test_withdraw_from_self_locked_fail(gas_bank, alice, bob, mockAction):
    """user cannot withdraw more than what is required in actions"""
    gas_bank.depositFor(bob, {"from": alice, "value": scale(5)})
    mockAction.setEthRequiredForGas(bob, scale(5))
    with reverts("not enough funds to withdraw"):
        gas_bank.withdrawFrom(bob, scale(1), {"from": bob})


def test_withdraw_from_action_no_locked(gas_bank, alice, bob, mockAction):
    gas_bank.depositFor(bob, {"from": alice, "value": scale(5)})
    tx = mockAction.withdrawFromGasBank(gas_bank, bob, scale(5), {"from": alice})
    assert tx.events["Withdraw"]["account"] == bob
    assert tx.events["Withdraw"]["receiver"] == mockAction.address
    assert tx.events["Withdraw"]["value"] == scale(5)
    assert mockAction.balance() == scale(5)
    assert gas_bank.balanceOf(bob) == 0


def test_withdraw_from_action_locked(gas_bank, alice, bob, mockAction):
    """action can withdraw on behalf of user even if funds are locked"""
    gas_bank.depositFor(bob, {"from": alice, "value": scale(5)})
    mockAction.setEthRequiredForGas(bob, scale(5))
    tx = mockAction.withdrawFromGasBank(gas_bank, bob, scale(5), {"from": alice})
    assert tx.events["Withdraw"]["account"] == bob
    assert tx.events["Withdraw"]["receiver"] == mockAction.address
    assert tx.events["Withdraw"]["value"] == scale(5)
    assert mockAction.balance() == scale(5)
    assert gas_bank.balanceOf(bob) == 0


def test_withdraw_unused_no_locked(gas_bank, alice):
    gas_bank.depositFor(alice, {"from": alice, "value": scale(5)})
    alice_balance = alice.balance()
    tx = gas_bank.withdrawUnused(alice, {"from": alice})
    assert tx.events["Withdraw"]["value"] == scale(5)
    assert gas_bank.balanceOf(alice) == 0
    assert alice.balance() - alice_balance == scale(5) - tx.gas_used * tx.gas_price


def test_withdraw_unused_locked(gas_bank, alice, mockAction):
    gas_bank.depositFor(alice, {"from": alice, "value": scale(5)})
    mockAction.setEthRequiredForGas(alice, scale(1))
    alice_balance = alice.balance()
    tx = gas_bank.withdrawUnused(alice, {"from": alice})
    assert tx.events["Withdraw"]["value"] == scale(4)
    assert gas_bank.balanceOf(alice) == scale(1)
    assert alice.balance() - alice_balance == scale(4) - tx.gas_used * tx.gas_price
