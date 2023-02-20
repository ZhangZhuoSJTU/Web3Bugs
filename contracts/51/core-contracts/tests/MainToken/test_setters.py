import brownie


def test_set_minter_admin_only(chuck, bob, token):
    with brownie.reverts("dev: admin only"):
        token.set_minter(bob, {"from": chuck})


def test_set_admin_admin_only(chuck, bob, token):
    with brownie.reverts("dev: admin only"):
        token.set_admin(bob, {"from": chuck})


def test_set_name_admin_only(chuck, token):
    with brownie.reverts("Only admin is allowed to change name"):
        token.set_name("Foo Token", "FOO", {"from": chuck})


def test_set_minter(admin, alice, token):
    token.set_minter(alice, {"from": admin})

    assert token.minter() == alice


def test_set_admin(admin, alice, token):
    token.set_admin(alice, {"from": admin})

    assert token.admin() == alice


def test_set_name(admin, token):
    token.set_name("Foo Token", "FOO", {"from": admin})

    assert token.name() == "Foo Token"
    assert token.symbol() == "FOO"
