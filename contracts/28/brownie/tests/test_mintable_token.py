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

# def test_init(mintable_token):
#     name = "Mintable Token"
#     symbol = "MNT"
#     owner = accounts[0]

#     mintable_token.initToken(name, symbol, owner,0, {'from': owner})
#     assert mintable_token.name() == name
#     assert mintable_token.symbol() == symbol
#     assert mintable_token.owner() == owner
    
# def test_mint_token(mintable_token):
#     amount = 1000 * 10 ** 18
#     assert mintable_token.balanceOf(accounts[0]) == 0
#     owner = mintable_token.owner()
#     print(owner)
#     mintable_token.mint(accounts[0], amount, {'from': accounts[0]})
#     assert mintable_token.balanceOf(accounts[0]) == amount