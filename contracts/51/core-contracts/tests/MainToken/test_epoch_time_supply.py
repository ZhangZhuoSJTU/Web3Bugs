import brownie
from tests.conftest import DAY, EPOCH, INFLATION_DELAY


def test_start(MainToken, admin, chain):
    token = MainToken.deploy("BOOT Finance Token", "BOOT", 18, {'from': admin})
    creation_time = token.start_epoch_time()
    assert chain.time() - creation_time < EPOCH


def test_start_epoch_time_write(MainToken, chain, admin):
    token = MainToken.deploy("BOOT Finance Token", "BOOT", 18, {'from': admin})
    creation_time = token.start_epoch_time()

    chain.sleep(EPOCH)
    chain.mine()

    # the constant function should not report a changed value
    assert token.start_epoch_time() == creation_time

    # the state-changing function should show the changed value
    assert token.start_epoch_time_write().return_value == creation_time + EPOCH

    # after calling the state-changing function, the view function is changed
    assert token.start_epoch_time() == creation_time + EPOCH


def test_start_epoch_time_write_same_epoch(token, chain, accounts):
    # calling `start_epoch_token_write` within the same epoch should not raise
    token.start_epoch_time_write()
    token.start_epoch_time_write()


def test_update_mining_parameters(MainToken, chain, admin):
    token = MainToken.deploy("BOOT Finance Token", "BOOT", 18, {'from': admin})
    creation_time = token.start_epoch_time()
    until_end_of_current_epoch = EPOCH - (chain.time() - creation_time)
    chain.sleep(until_end_of_current_epoch)
    token.update_mining_parameters({"from": admin})


def test_update_mining_parameters_same_epoch(MainToken, chain, admin):
    token = MainToken.deploy("BOOT Finance Token", "BOOT", 18, {'from': admin})
    creation_time = token.start_epoch_time()
    until_end_of_current_epoch = EPOCH - (chain.time() - creation_time)
    chain.sleep(until_end_of_current_epoch - DAY)
    with brownie.reverts("dev: too soon!"):
        token.update_mining_parameters({"from": admin})


def test_available_supply(admin, chain, web3, MainToken):
    token = MainToken.deploy("BOOT Finance Token", "BOOT", 18, {'from': admin})
    chain.sleep(token.start_epoch_time() + EPOCH - chain.time()) 
    token.update_mining_parameters({"from": admin})

    start_time = token.start_epoch_time()
    initial_supply = token.totalSupply()
    rate = token.rate()
    chain.sleep(DAY)
    chain.mine()
    expected = initial_supply + (chain.time() - start_time) * rate
    assert token.available_supply() == expected
