TOKEN_DECIMALS = 18
TOKEN_TOTAL_SUPPLY = 8000000
OI_CAP = 800000
AMOUNT_IN = 1e18


def test_balances(token, gov, rewards, alice, bob, feed_owner):
    assert token.totalSupply() == token.balanceOf(bob) + token.balanceOf(alice)
    assert token.balanceOf(gov) == 0
    assert token.balanceOf(rewards) == 0
    assert token.balanceOf(feed_owner) == 0


def test_params(market):
    # TODO: test all factory and market params set properly
    pass


def test_markets(market):
    assert market.oiCap() == OI_CAP*10**TOKEN_DECIMALS


def test_market_is_enabled(market):
    pass


def test_market_erc1155(market):
    pass
