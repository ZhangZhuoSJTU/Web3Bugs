WEEK = 86400 * 7
YEAR = 365 * 86400
EPOCH = WEEK
DELAY = 3 * 3600


def test_rate(admin, chain, MainToken):
    token = MainToken.deploy("BOOT Finance Token", "BOOT", 18, {'from': admin})
    assert token.rate() == 0

    chain.sleep(86401)
    token.update_mining_parameters({"from": admin})

    assert token.rate() > 0


def test_start_epoch_time(admin, chain, MainToken):
    token = MainToken.deploy("BOOT Finance Token", "BOOT", 18, {'from': admin})
    creation_time = token.start_epoch_time()
    assert creation_time == token.tx.timestamp + DELAY - EPOCH

    chain.sleep(86401)
    token.update_mining_parameters({"from": admin})

    assert token.start_epoch_time() == creation_time + EPOCH


def test_mining_epoch(admin, chain, MainToken):
    token = MainToken.deploy("BOOT Finance Token", "BOOT", 18, {'from': admin})
    assert token.mining_epoch() == -1

    chain.sleep(86401)
    token.update_mining_parameters({"from": admin})

    assert token.mining_epoch() == 0
