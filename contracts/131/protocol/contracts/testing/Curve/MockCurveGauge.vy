# @version 0.2.4
"""
@title Mock Liquidity Gauge
@author Curve Finance
@license MIT
@notice Used for measuring liquidity and insurance
"""

from vyper.interfaces import ERC20

interface Minter:
    def token() -> address: view
    def controller() -> address: view
    def minted(user: address, gauge: address) -> uint256: view


TOKENLESS_PRODUCTION: constant(uint256) = 40
BOOST_WARMUP: constant(uint256) = 2 * 7 * 86400
WEEK: constant(uint256) = 604800

minter: public(address)
crv_token: public(address)
lp_token: public(address)
controller: public(address)
balanceOf: public(HashMap[address, uint256])
totalSupply: public(uint256)

# for testing
claimable: public(HashMap[address, uint256])

# caller -> recipient -> can deposit?
approved_to_deposit: public(HashMap[address, HashMap[address, bool]])

admin: public(address)

@external
def __init__(lp_addr: address, _minter: address, _admin: address):
    """
    @notice Contract constructor
    @param lp_addr Liquidity Pool contract address
    @param _minter Minter contract address
    @param _admin Admin who can kill the gauge
    """

    assert lp_addr != ZERO_ADDRESS
    assert _minter != ZERO_ADDRESS

    self.lp_token = lp_addr
    self.minter = _minter
    crv_addr: address = Minter(_minter).token()
    self.crv_token = crv_addr
    self.admin = _admin


@external
def claimable_tokens(addr: address) -> uint256:
    """
    @notice Get the number of claimable tokens per user
    @dev This function should be manually changed to "view" in the ABI
    @return uint256 number of claimable tokens per user
    """
    #return self.integrate_fraction[addr] - Minter(self.minter).minted(addr, self)
    return self.claimable[addr]


@external
def set_approve_deposit(addr: address, can_deposit: bool):
    """
    @notice Set whether `addr` can deposit tokens for `msg.sender`
    @param addr Address to set approval on
    @param can_deposit bool - can this account deposit for `msg.sender`?
    """
    self.approved_to_deposit[addr][msg.sender] = can_deposit


@external
@nonreentrant('lock')
def deposit(_value: uint256, addr: address = msg.sender):
    """
    @notice Deposit `_value` LP tokens
    @param _value Number of tokens to deposit
    @param addr Address to deposit for
    """
    if addr != msg.sender:
        assert self.approved_to_deposit[msg.sender][addr], "Not approved"

    if _value != 0:
        _balance: uint256 = self.balanceOf[addr] + _value
        _supply: uint256 = self.totalSupply + _value
        self.balanceOf[addr] = _balance
        self.totalSupply = _supply

        assert ERC20(self.lp_token).transferFrom(msg.sender, self, _value)


@external
@nonreentrant('lock')
def withdraw(_value: uint256):
    """
    @notice Withdraw `_value` LP tokens
    @param _value Number of tokens to withdraw
    """
    _balance: uint256 = self.balanceOf[msg.sender] - _value
    _supply: uint256 = self.totalSupply - _value
    self.balanceOf[msg.sender] = _balance
    self.totalSupply = _supply

    assert ERC20(self.lp_token).transfer(msg.sender, _value)


# For tests
@external
def set_claimable_tokens(_addr: address, _amount: uint256):
    self.claimable[_addr] = _amount
