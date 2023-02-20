import brownie

WEEK = 86400 * 7
YEAR = 365 * 86400
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


def test_burn(faucet, token):
    balance = token.balanceOf(faucet)
    initial_supply = token.totalSupply()
    token.burn(31337, {"from": faucet})

    assert token.balanceOf(faucet) == balance - 31337
    assert token.totalSupply() == initial_supply - 31337


def test_burn_not_admin(accounts, token):
    initial_supply = token.totalSupply()
    token.transfer(accounts[1], 1000000, {"from": accounts[0]})
    token.burn(31337, {"from": accounts[1]})

    assert token.balanceOf(accounts[1]) == 1000000 - 31337
    assert token.totalSupply() == initial_supply - 31337


def test_burn_all(accounts, token):
    initial_supply = token.totalSupply()
    token.burn(initial_supply, {"from": accounts[0]})

    assert token.balanceOf(accounts[0]) == 0
    assert token.totalSupply() == 0


def test_overburn(accounts, token):
    initial_supply = token.totalSupply()

    with brownie.reverts("Integer underflow"):
        token.burn(initial_supply + 1, {"from": accounts[0]})
