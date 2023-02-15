# @version 0.2.4
"""
@title Curve DAO Token
@author Curve Finance
@license MIT
@notice ERC20 with piecewise-linear mining supply.
@dev Based on the ERC-20 token standard as defined at
     https://eips.ethereum.org/EIPS/eip-20
"""

from vyper.interfaces import ERC20

implements: ERC20


event Transfer:
    _from: indexed(address)
    _to: indexed(address)
    _value: uint256

event Approval:
    _owner: indexed(address)
    _spender: indexed(address)
    _value: uint256

event UpdateMiningParameters:
    time: uint256
    rate: uint256
    supply: uint256

event SetMinter:
    minter: address

event SetAdmin:
    admin: address

event SetMintMultisig:
    minting_multisig: address


name: public(String[64])
symbol: public(String[32])
decimals: public(uint256)

balanceOf: public(HashMap[address, uint256])
allowances: HashMap[address, HashMap[address, uint256]]
total_supply: uint256
minted_supply: uint256
dev_remaining: public(uint256)

minter: public(address)
minting_multisig: public(address)
admin: public(address)

# General constants
HOUR: constant(uint256) = 3600
DAY: constant(uint256) = 86400
WEEK: constant(uint256) = 86400 * 7
YEAR: constant(uint256) = WEEK * 52

# Allocation:
# ===========
# WE GIVE IT BACK TO YOU ... THE PEOPLE: 100%
# lol - jk, we don't, we saw how that went. - chickenpie347

# Supply parameters
INITIAL_SUPPLY: constant(uint256) = 0
INFLATION_DELAY: constant(uint256) = 3 * HOUR # Three Hour delay before minting may begin
RATE_DENOMINATOR: constant(uint256) = 10 ** 18
RATE_TIME: constant(uint256) = WEEK # How often the rate goes to the next epoch
INITIAL_RATE: constant(uint256) = 2_472_621 * 125 * 10 ** 15 / WEEK # 2_472_621 for the first week
EPOCH_INFLATION: constant(uint256) = 98831193898177700   # 98.831% of last week
LATE_FIX_RATE: constant(uint256) = 300 # 0.03% total supply
INITIAL_RATE_EPOCH_CUTTOF: constant(uint256) = 260 # After 260 Weeks use the late rate
DEV_MINTABLE: constant(uint256) = 176400000 # tokens for other allocations, community, etc, excl. fixed LP rewards.

# Supply variables
mining_epoch: public(int128)
start_epoch_time: public(uint256)
rate: public(uint256)

start_epoch_supply: uint256


@external
def __init__(_name: String[64], _symbol: String[32], _decimals: uint256):
    """
    @notice Contract constructor
    @param _name Token full name
    @param _symbol Token symbol
    @param _decimals Number of decimals for token
    """
    init_supply: uint256 = INITIAL_SUPPLY * 10 ** _decimals
    self.name = _name
    self.symbol = _symbol
    self.decimals = _decimals
    self.balanceOf[msg.sender] = init_supply
    self.total_supply = init_supply
    self.dev_remaining = DEV_MINTABLE * 10 ** _decimals
    self.admin = msg.sender
    log Transfer(ZERO_ADDRESS, msg.sender, init_supply)

    self.start_epoch_time = block.timestamp + INFLATION_DELAY - RATE_TIME
    self.mining_epoch = -1
    self.rate = 0
    self.start_epoch_supply = init_supply


@internal
def _update_mining_parameters():
    """
    @dev Update mining rate and supply at the start of the epoch
         Any modifying mining call must also call this
    """
    _rate: uint256 = self.rate
    _start_epoch_supply: uint256 = self.start_epoch_supply
    
    self.mining_epoch += 1
    self.start_epoch_time += RATE_TIME

    if self.mining_epoch == 0:
        _rate = INITIAL_RATE
    else:
        _start_epoch_supply += _rate * RATE_TIME

        if self.mining_epoch < INITIAL_RATE_EPOCH_CUTTOF:
            _rate = _rate * EPOCH_INFLATION / 100000000000000000
        else:
            _rate = (_start_epoch_supply * LATE_FIX_RATE / 10000) / YEAR

    self.start_epoch_supply = _start_epoch_supply
    self.rate = _rate

    log UpdateMiningParameters(block.timestamp, _rate, _start_epoch_supply)


@external
def update_mining_parameters():
    """
    @notice Update mining rate and supply at the start of the epoch
    @dev Callable by any address, but only once per epoch
         Total supply becomes slightly larger if this function is called late
    """
    assert block.timestamp >= self.start_epoch_time + RATE_TIME  # dev: too soon!
    self._update_mining_parameters()


@external
def start_epoch_time_write() -> uint256:
    """
    @notice Get timestamp of the current mining epoch start
            while simultaneously updating mining parameters
    @return Timestamp of the epoch
    """
    _start_epoch_time: uint256 = self.start_epoch_time
    if block.timestamp >= _start_epoch_time + RATE_TIME:
        self._update_mining_parameters()
        return self.start_epoch_time
    else:
        return _start_epoch_time


@external
def future_epoch_time_write() -> uint256:
    """
    @notice Get timestamp of the next mining epoch start
            while simultaneously updating mining parameters
    @return Timestamp of the next epoch
    """
    _start_epoch_time: uint256 = self.start_epoch_time
    if block.timestamp >= _start_epoch_time + RATE_TIME:
        self._update_mining_parameters()
        return self.start_epoch_time + RATE_TIME
    else:
        return _start_epoch_time + RATE_TIME


@internal
@view
def _available_supply() -> uint256:
    # The available supply is undefined if _update_mining_parameters() is not called
    # prior to this function precisely at the beginning of each new epoch.  At best
    # the returned value would be using the prior epoch's parameters.
    #
    assert block.timestamp - self.start_epoch_time <= RATE_TIME

    return self.start_epoch_supply + (block.timestamp - self.start_epoch_time) * self.rate


@external
@view
def available_supply() -> uint256:
    """
    @notice Current number of tokens in existence (claimed or unclaimed)
    """
    return self._available_supply()


@external
def set_minter(_minter: address):
    """
    @notice Set the minter address
    @dev Only callable once, when minter has not yet been set
    @param _minter Address of the minter
    """
    assert msg.sender == self.admin  # dev: admin only
    assert self.minter == ZERO_ADDRESS  # dev: can set the minter only once, at creation
    self.minter = _minter
    log SetMinter(_minter)


@external
def set_admin(_admin: address):
    """
    @notice Set the new admin.
    @dev After all is set up, admin only can change the token name
    @param _admin New admin address
    """
    assert msg.sender == self.admin  # dev: admin only
    self.admin = _admin
    log SetAdmin(_admin)


@external
def set_mint_multisig(_minting_multisig: address):
    """
    @notice Set the new minting multisig address.
    @dev After all is set up, admin only can change the token name
    @param _minting_multisig New minting multisig address
    """
    assert msg.sender == self.admin  # dev: admin only
    self.minting_multisig = _minting_multisig
    log SetMintMultisig(_minting_multisig)


@external
@view
def totalSupply() -> uint256:
    """
    @notice Total number of tokens in existence.
    """
    return self.total_supply


@external
@view
def allowance(_owner : address, _spender : address) -> uint256:
    """
    @notice Check the amount of tokens that an owner allowed to a spender
    @param _owner The address which owns the funds
    @param _spender The address which will spend the funds
    @return uint256 specifying the amount of tokens still available for the spender
    """
    return self.allowances[_owner][_spender]


@external
def transfer(_to : address, _value : uint256) -> bool:
    """
    @notice Transfer `_value` tokens from `msg.sender` to `_to`
    @dev Vyper does not allow underflows, so the subtraction in
         this function will revert on an insufficient balance
    @param _to The address to transfer to
    @param _value The amount to be transferred
    @return bool success
    """
    assert _to != ZERO_ADDRESS  # dev: transfers to 0x0 are not allowed
    self.balanceOf[msg.sender] -= _value
    self.balanceOf[_to] += _value
    log Transfer(msg.sender, _to, _value)
    return True


@external
def transferFrom(_from : address, _to : address, _value : uint256) -> bool:
    """
     @notice Transfer `_value` tokens from `_from` to `_to`
     @param _from address The address which you want to send tokens from
     @param _to address The address which you want to transfer to
     @param _value uint256 the amount of tokens to be transferred
     @return bool success
    """
    assert _to != ZERO_ADDRESS  # dev: transfers to 0x0 are not allowed
    # NOTE: vyper does not allow underflows
    #       so the following subtraction would revert on insufficient balance
    self.balanceOf[_from] -= _value
    self.balanceOf[_to] += _value
    self.allowances[_from][msg.sender] -= _value
    log Transfer(_from, _to, _value)
    return True


@external
def approve(_spender : address, _value : uint256) -> bool:
    """
    @notice Approve `_spender` to transfer `_value` tokens on behalf of `msg.sender`
    @dev Approval may only be from zero -> nonzero or from nonzero -> zero in order
        to mitigate the potential race condition described here:
        https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
    @param _spender The address which will spend the funds
    @param _value The amount of tokens to be spent
    @return bool success
    """
    assert _value == 0 or self.allowances[msg.sender][_spender] == 0
    self.allowances[msg.sender][_spender] = _value
    log Approval(msg.sender, _spender, _value)
    return True


@external
def mint(_to: address, _value: uint256) -> bool:
    """
    @notice Mint `_value` tokens and assign them to `_to`
    @dev Emits a Transfer event originating from 0x00
    @param _to The account that will receive the created tokens
    @param _value The amount that will be created
    @return bool success
    """
    assert msg.sender == self.minter  # dev: minter only
    assert _to != ZERO_ADDRESS  # dev: zero address

    if block.timestamp >= self.start_epoch_time + RATE_TIME:
        self._update_mining_parameters()

    _total_supply: uint256 = self.minted_supply + _value
    assert _total_supply <= self._available_supply()  # dev: exceeds allowable mint amount
    self.minted_supply = _total_supply
    self.total_supply += _value

    self.balanceOf[_to] += _value
    log Transfer(ZERO_ADDRESS, _to, _value)

    return True

@external
def mint_dev(_to: address, _value: uint256) -> bool:
    """
    @notice Mint `_value` tokens and assign them to `_to`
    @dev Emits a Transfer event originating from 0x00
    @param _to The account that will receive the created tokens
    @param _value The amount that will be created
    @return bool success
    """
    assert msg.sender == self.minting_multisig  # dev: mint_multisig only
    assert _to != ZERO_ADDRESS  # dev: zero address

    _total_supply: uint256 = self.total_supply + _value
    self.total_supply = _total_supply
    self.dev_remaining -= _value
    self.balanceOf[_to] += _value
    log Transfer(ZERO_ADDRESS, _to, _value)

    return True


@external
def burn(_value: uint256) -> bool:
    """
    @notice Burn `_value` tokens belonging to `msg.sender`
    @dev Emits a Transfer event with a destination of 0x00
    @param _value The amount that will be burned
    @return bool success
    """
    self.balanceOf[msg.sender] -= _value
    self.total_supply -= _value

    log Transfer(msg.sender, ZERO_ADDRESS, _value)
    return True


@external
def set_name(_name: String[64], _symbol: String[32]):
    """
    @notice Change the token name and symbol to `_name` and `_symbol`
    @dev Only callable by the admin account
    @param _name New token name
    @param _symbol New token symbol
    """
    assert msg.sender == self.admin, "Only admin is allowed to change name"
    self.name = _name
    self.symbol = _symbol
