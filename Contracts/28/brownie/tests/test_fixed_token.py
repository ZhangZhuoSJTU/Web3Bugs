from brownie import accounts, web3, Wei, reverts, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
from brownie import Contract

# Fixed token 

# reset the chain after every test case
@pytest.fixture(autouse=True)
def isolation(fn_isolation):
    pass

@pytest.fixture(scope='function')
def init_fixed_token(fixed_token):
    name = "Fixed Token"
    symbol = "FXT"
    owner = accounts[0]
    fixed_supply = 100000 * 10 ** 18

    fixed_token.initToken(name, symbol, owner, fixed_supply, {'from': owner})
    assert fixed_token.name() == name
    assert fixed_token.symbol() == symbol
    assert fixed_token.owner() == owner
    assert fixed_token.totalSupply() == fixed_supply
    assert fixed_token.balanceOf(owner) == fixed_supply

