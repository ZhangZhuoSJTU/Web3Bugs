from brownie import ZERO_ADDRESS
import pytest

from support.mainnet_contracts import TokenAddresses


@pytest.mark.mainnetFork
def test_get_ceth(ctoken_registry):
    assert ctoken_registry.getCToken(ZERO_ADDRESS) == TokenAddresses.C_ETH


@pytest.mark.mainnetFork
def test_get_cdai(ctoken_registry):
    assert ctoken_registry.getCToken(TokenAddresses.DAI) == TokenAddresses.C_DAI
