import pytest
from brownie import ZERO_ADDRESS

pytestmark = pytest.mark.usefixtures("setUpVault")


@pytest.fixture
def setUpVault(admin, vault, mockStrategy):
    mockStrategy.setVault(vault, {"from": admin})
    vault.setStrategy(ZERO_ADDRESS, {"from": admin})


def test_has_no_strategy_by_default(vault):
    assert vault.getStrategy() == ZERO_ADDRESS


def test_reverts_initializing_strategy_from_non_admin(vault, mockStrategy, bob):
    with pytest.reverts("unauthorized access"):
        vault.initializeStrategy(mockStrategy, {"from": bob})


def test_reverts_initializing_strategy_with_zero_address(vault, admin):
    with pytest.reverts("zero address not allowed"):
        vault.initializeStrategy(ZERO_ADDRESS, {"from": admin})


def test_initializing_strategy(vault, mockStrategy, admin):
    vault.initializeStrategy(mockStrategy, {"from": admin})
    assert vault.getStrategy() == mockStrategy


def test_reverts_initializing_strategy_when_already_initialized(
    vault, mockStrategy, admin
):
    vault.initializeStrategy(mockStrategy, {"from": admin})
    with pytest.reverts("Address is already set"):
        vault.initializeStrategy(mockStrategy, {"from": admin})
