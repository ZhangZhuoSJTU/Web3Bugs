import brownie
from brownie import Treasury, ZERO_ADDRESS


def test_constructor(deployer, payoutToken):
    with brownie.reverts("payout token = zero"):
        Treasury.deploy(ZERO_ADDRESS, {"from": deployer})

    treasury = Treasury.deploy(payoutToken, {"from": deployer})

    assert treasury.owner() == deployer
    assert treasury.payoutToken() == payoutToken


def test_set_bond_contract(deployer, treasury, user):
    with brownie.reverts("not owner"):
        treasury.setBondContract(user, True, {"from": user})

    tx = treasury.setBondContract(user, True, {"from": deployer})

    assert treasury.isBondContract(user)

    assert len(tx.events) == 1
    assert tx.events["SetBondContract"].values() == [user, True]

    with brownie.reverts("no change"):
        treasury.setBondContract(user, True, {"from": deployer})


def test_deposit(deployer, treasury, principalToken, payoutToken, user):
    principalToken.mint(user, 123, {"from": user})
    principalToken.approve(treasury, 123, {"from": user})

    payoutToken.mint(treasury, 456, {"from": deployer})

    with brownie.reverts("not bond"):
        treasury.deposit(principalToken, 123, 456, {"from": deployer})

    def snapshot():
        return {
            "principalToken": {
                "user": principalToken.balanceOf(user),
                "treasury": principalToken.balanceOf(treasury),
            },
            "payoutToken": {
                "user": payoutToken.balanceOf(user),
                "treasury": payoutToken.balanceOf(treasury),
            },
        }

    before = snapshot()
    treasury.deposit(principalToken, 123, 456, {"from": user})
    after = snapshot()

    assert after["principalToken"]["user"] == before["principalToken"]["user"] - 123
    assert (
        after["principalToken"]["treasury"]
        == before["principalToken"]["treasury"] + 123
    )
    assert after["payoutToken"]["user"] == before["payoutToken"]["user"] + 456
    assert after["payoutToken"]["treasury"] == before["payoutToken"]["treasury"] - 456


def test_withdraw(deployer, treasury, principalToken, user, dest):
    principalToken.mint(treasury, 123, {"from": deployer})

    with brownie.reverts("not owner"):
        treasury.withdraw(principalToken, dest, 123, {"from": user})

    def snapshot():
        return {
            "principalToken": {
                "dest": principalToken.balanceOf(dest),
                "treasury": principalToken.balanceOf(treasury),
            },
        }

    before = snapshot()
    tx = treasury.withdraw(principalToken, dest, 123, {"from": deployer})
    after = snapshot()

    assert after["principalToken"]["dest"] == before["principalToken"]["dest"] + 123
    assert (
        after["principalToken"]["treasury"]
        == before["principalToken"]["treasury"] - 123
    )

    assert len(tx.events) == 2
    assert tx.events["Withdraw"].values() == [principalToken, dest, 123]


def test_value_of_token(treasury, payoutToken, principalToken):
    principalDecimals = principalToken.decimals()
    payoutDecimals = payoutToken.decimals()

    amount = 1234567 * 10 ** principalDecimals
    value = treasury.valueOfToken(principalToken, amount)

    assert value == 1234567 * 10 ** payoutDecimals
