import brownie


def test_only_minter(token, alice):
    EXPECTED_ERROR_MSG = 'only minter'
    with brownie.reverts(EXPECTED_ERROR_MSG):
        token.mint(alice, 1 * 10 ** token.decimals(), {"from": alice})


def test_only_burner(token, bob):
    EXPECTED_ERROR_MSG = 'only burner'
    with brownie.reverts(EXPECTED_ERROR_MSG):
        token.burn(bob, 1 * 10 ** token.decimals(), {"from": bob})


def test_mint(token, minter, alice):
    before = token.balanceOf(alice)
    amount = 1 * 10 ** token.decimals()
    token.mint(alice, amount, {"from": minter})
    assert token.balanceOf(alice) == before + amount


def test_burn(token, burner, bob):
    before = token.balanceOf(bob)
    amount = 1 * 10 ** token.decimals()
    token.burn(bob, amount, {"from": burner})
    assert token.balanceOf(bob) == before - amount


def test_mint_then_burn(token, market, alice):
    before = token.balanceOf(alice)
    token.mint(alice, 20 * 10 ** token.decimals(), {"from": market})
    mid = before + 20 * 10 ** token.decimals()
    assert token.balanceOf(alice) == mid
    token.burn(alice, 15 * 10 ** token.decimals(), {"from": market})
    assert token.balanceOf(alice) == mid - 15 * 10 ** token.decimals()
