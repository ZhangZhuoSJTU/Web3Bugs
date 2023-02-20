
def test_admin_grant_mint_role_then_revoke(token, admin, rando):
    token.grantRole(token.MINTER_ROLE(), rando, {"from": admin})
    assert token.hasRole(token.MINTER_ROLE(), rando) is True

    token.revokeRole(token.MINTER_ROLE(), rando, {"from": admin})
    assert token.hasRole(token.MINTER_ROLE(), rando) is False


def test_admin_grant_burn_role_then_revoke(token, admin, rando):
    token.grantRole(token.BURNER_ROLE(), rando, {"from": admin})
    assert token.hasRole(token.BURNER_ROLE(), rando) is True

    token.revokeRole(token.BURNER_ROLE(), rando, {"from": admin})
    assert token.hasRole(token.BURNER_ROLE(), rando) is False
