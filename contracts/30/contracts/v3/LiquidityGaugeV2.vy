# @version 0.2.8
"""
@title Liquidity Gauge v2
@author Curve Finance
@license MIT
"""

from vyper.interfaces import ERC20

implements: ERC20


interface CRV20:
    def future_epoch_time_write() -> uint256: nonpayable
    def rate() -> uint256: view

interface Controller:
    def period() -> int128: view
    def period_write() -> int128: nonpayable
    def period_timestamp(p: int128) -> uint256: view
    def gauge_relative_weight(addr: address, time: uint256) -> uint256: view
    def voting_escrow() -> address: view
    def checkpoint(): nonpayable
    def checkpoint_gauge(addr: address): nonpayable

interface Minter:
    def token() -> address: view
    def controller() -> address: view
    def minted(user: address, gauge: address) -> uint256: view

interface VotingEscrow:
    def user_point_epoch(addr: address) -> uint256: view
    def user_point_history__ts(addr: address, epoch: uint256) -> uint256: view

interface ERC20Extended:
    def symbol() -> String[26]: view


event Deposit:
    provider: indexed(address)
    value: uint256

event Withdraw:
    provider: indexed(address)
    value: uint256

event UpdateLiquidityLimit:
    user: address
    original_balance: uint256
    original_supply: uint256
    working_balance: uint256
    working_supply: uint256

event CommitOwnership:
    admin: address

event ApplyOwnership:
    admin: address

event Transfer:
    _from: indexed(address)
    _to: indexed(address)
    _value: uint256

event Approval:
    _owner: indexed(address)
    _spender: indexed(address)
    _value: uint256


MAX_REWARDS: constant(uint256) = 8
TOKENLESS_PRODUCTION: constant(uint256) = 40
WEEK: constant(uint256) = 604800

minter: public(address)
crv_token: public(address)
lp_token: public(address)
controller: public(address)
voting_escrow: public(address)
future_epoch_time: public(uint256)

balanceOf: public(HashMap[address, uint256])
totalSupply: public(uint256)
allowances: HashMap[address, HashMap[address, uint256]]

name: public(String[64])
symbol: public(String[32])

# caller -> recipient -> can deposit?
approved_to_deposit: public(HashMap[address, HashMap[address, bool]])

working_balances: public(HashMap[address, uint256])
working_supply: public(uint256)

# The goal is to be able to calculate ∫(rate * balance / totalSupply dt) from 0 till checkpoint
# All values are kept in units of being multiplied by 1e18
period: public(int128)
period_timestamp: public(uint256[100000000000000000000000000000])

# 1e18 * ∫(rate(t) / totalSupply(t) dt) from 0 till checkpoint
integrate_inv_supply: public(uint256[100000000000000000000000000000])  # bump epoch when rate() changes

# 1e18 * ∫(rate(t) / totalSupply(t) dt) from (last_action) till checkpoint
integrate_inv_supply_of: public(HashMap[address, uint256])
integrate_checkpoint_of: public(HashMap[address, uint256])

# ∫(balance * rate(t) / totalSupply(t) dt) from 0 till checkpoint
# Units: rate * t = already number of coins per address to issue
integrate_fraction: public(HashMap[address, uint256])

inflation_rate: public(uint256)

# For tracking external rewards
reward_contract: public(address)
reward_tokens: public(address[MAX_REWARDS])

# deposit / withdraw / claim
reward_sigs: bytes32

# reward token -> integral
reward_integral: public(HashMap[address, uint256])

# reward token -> claiming address -> integral
reward_integral_for: public(HashMap[address, HashMap[address, uint256]])

admin: public(address)
future_admin: public(address)  # Can and will be a smart contract
is_killed: public(bool)


@external
def __init__(_lp_token: address, _minter: address, _admin: address):
    """
    @notice Contract constructor
    @param _lp_token Liquidity Pool contract address
    @param _minter Minter contract address
    @param _admin Admin who can kill the gauge
    """

    symbol: String[26] = ERC20Extended(_lp_token).symbol()
    self.name = concat("yAxis ", symbol, " Gauge Deposit")
    self.symbol = concat(symbol, "-gauge")

    crv_token: address = Minter(_minter).token()
    controller: address = Minter(_minter).controller()

    self.lp_token = _lp_token
    self.minter = _minter
    self.admin = _admin
    self.crv_token = crv_token
    self.controller = controller
    self.voting_escrow = Controller(controller).voting_escrow()

    self.period_timestamp[0] = block.timestamp
    self.inflation_rate = CRV20(crv_token).rate()
    self.future_epoch_time = CRV20(crv_token).future_epoch_time_write()


@view
@external
def decimals() -> uint256:
    """
    @notice Get the number of decimals for this token
    @dev Implemented as a view method to reduce gas costs
    @return uint256 decimal places
    """
    return 18


@view
@external
def integrate_checkpoint() -> uint256:
    return self.period_timestamp[self.period]


@internal
def _update_liquidity_limit(addr: address, l: uint256, L: uint256):
    """
    @notice Calculate limits which depend on the amount of CRV token per-user.
            Effectively it calculates working balances to apply amplification
            of CRV production by CRV
    @param addr User address
    @param l User's amount of liquidity (LP tokens)
    @param L Total amount of liquidity (LP tokens)
    """
    # To be called after totalSupply is updated
    _voting_escrow: address = self.voting_escrow
    voting_balance: uint256 = ERC20(_voting_escrow).balanceOf(addr)
    voting_total: uint256 = ERC20(_voting_escrow).totalSupply()

    lim: uint256 = l * TOKENLESS_PRODUCTION / 100
    if voting_total > 0:
        lim += L * voting_balance / voting_total * (100 - TOKENLESS_PRODUCTION) / 100

    lim = min(l, lim)
    old_bal: uint256 = self.working_balances[addr]
    self.working_balances[addr] = lim
    _working_supply: uint256 = self.working_supply + lim - old_bal
    self.working_supply = _working_supply

    log UpdateLiquidityLimit(addr, l, L, lim, _working_supply)


@internal
def _checkpoint_rewards(_addr: address, _total_supply: uint256):
    """
    @notice Claim pending rewards and checkpoint rewards for a user
    """
    if _total_supply == 0:
        return

    reward_balances: uint256[MAX_REWARDS] = empty(uint256[MAX_REWARDS])
    reward_tokens: address[MAX_REWARDS] = empty(address[MAX_REWARDS])
    for i in range(MAX_REWARDS):
        token: address = self.reward_tokens[i]
        if token == ZERO_ADDRESS:
            break
        reward_tokens[i] = token
        reward_balances[i] = ERC20(token).balanceOf(self)

    # claim from reward contract
    raw_call(self.reward_contract, slice(self.reward_sigs, 8, 4))  # dev: bad claim sig

    user_balance: uint256 = self.balanceOf[_addr]
    for i in range(MAX_REWARDS):
        token: address = reward_tokens[i]
        if token == ZERO_ADDRESS:
            break
        dI: uint256 = 10**18 * (ERC20(token).balanceOf(self) - reward_balances[i]) / _total_supply
        if _addr == ZERO_ADDRESS:
            if dI != 0:
                self.reward_integral[token] += dI
            continue

        integral: uint256 = self.reward_integral[token] + dI
        if dI != 0:
            self.reward_integral[token] = integral

        integral_for: uint256 = self.reward_integral_for[token][_addr]
        if integral_for < integral:
            claimable: uint256 = user_balance * (integral - integral_for) / 10**18
            self.reward_integral_for[token][_addr] = integral
            if claimable != 0:
                response: Bytes[32] = raw_call(
                    token,
                    concat(
                        method_id("transfer(address,uint256)"),
                        convert(_addr, bytes32),
                        convert(claimable, bytes32),
                    ),
                    max_outsize=32,
                )
                if len(response) != 0:
                    assert convert(response, bool)


@internal
def _checkpoint(addr: address):
    """
    @notice Checkpoint for a user
    @param addr User address
    """
    _period: int128 = self.period
    _period_time: uint256 = self.period_timestamp[_period]
    _integrate_inv_supply: uint256 = self.integrate_inv_supply[_period]
    rate: uint256 = self.inflation_rate
    new_rate: uint256 = rate
    prev_future_epoch: uint256 = self.future_epoch_time
    if prev_future_epoch >= _period_time:
        _token: address = self.crv_token
        self.future_epoch_time = CRV20(_token).future_epoch_time_write()
        new_rate = CRV20(_token).rate()
        self.inflation_rate = new_rate

    if self.is_killed:
        # Stop distributing inflation as soon as killed
        rate = 0

    # Update integral of 1/supply
    if block.timestamp > _period_time:
        _working_supply: uint256 = self.working_supply
        _controller: address = self.controller
        Controller(_controller).checkpoint_gauge(self)
        prev_week_time: uint256 = _period_time
        week_time: uint256 = min((_period_time + WEEK) / WEEK * WEEK, block.timestamp)

        for i in range(500):
            dt: uint256 = week_time - prev_week_time
            w: uint256 = Controller(_controller).gauge_relative_weight(self, prev_week_time / WEEK * WEEK)

            if _working_supply > 0:
                if prev_future_epoch >= prev_week_time and prev_future_epoch < week_time:
                    # If we went across one or multiple epochs, apply the rate
                    # of the first epoch until it ends, and then the rate of
                    # the last epoch.
                    # If more than one epoch is crossed - the gauge gets less,
                    # but that'd meen it wasn't called for more than 1 year
                    _integrate_inv_supply += rate * w * (prev_future_epoch - prev_week_time) / _working_supply
                    rate = new_rate
                    _integrate_inv_supply += rate * w * (week_time - prev_future_epoch) / _working_supply
                else:
                    _integrate_inv_supply += rate * w * dt / _working_supply
                # On precisions of the calculation
                # rate ~= 10e18
                # last_weight > 0.01 * 1e18 = 1e16 (if pool weight is 1%)
                # _working_supply ~= TVL * 1e18 ~= 1e26 ($100M for example)
                # The largest loss is at dt = 1
                # Loss is 1e-9 - acceptable

            if week_time == block.timestamp:
                break
            prev_week_time = week_time
            week_time = min(week_time + WEEK, block.timestamp)

    _period += 1
    self.period = _period
    self.period_timestamp[_period] = block.timestamp
    self.integrate_inv_supply[_period] = _integrate_inv_supply

    # Update user-specific integrals
    _working_balance: uint256 = self.working_balances[addr]
    self.integrate_fraction[addr] += _working_balance * (_integrate_inv_supply - self.integrate_inv_supply_of[addr]) / 10 ** 18
    self.integrate_inv_supply_of[addr] = _integrate_inv_supply
    self.integrate_checkpoint_of[addr] = block.timestamp


@external
def user_checkpoint(addr: address) -> bool:
    """
    @notice Record a checkpoint for `addr`
    @param addr User address
    @return bool success
    """
    assert (msg.sender == addr) or (msg.sender == self.minter)  # dev: unauthorized
    self._checkpoint(addr)
    self._update_liquidity_limit(addr, self.balanceOf[addr], self.totalSupply)
    return True


@external
def claimable_tokens(addr: address) -> uint256:
    """
    @notice Get the number of claimable tokens per user
    @dev This function should be manually changed to "view" in the ABI
    @return uint256 number of claimable tokens per user
    """
    self._checkpoint(addr)
    return self.integrate_fraction[addr] - Minter(self.minter).minted(addr, self)


@external
@nonreentrant('lock')
def claimable_reward(_addr: address, _token: address) -> uint256:
    """
    @notice Get the number of claimable reward tokens for a user
    @dev This function should be manually changed to "view" in the ABI
         Calling it via a transaction will claim available reward tokens
    @param _addr Account to get reward amount for
    @param _token Token to get reward amount for
    @return uint256 Claimable reward token amount
    """
    claimable: uint256 = ERC20(_token).balanceOf(_addr)
    if self.reward_contract != ZERO_ADDRESS:
        self._checkpoint_rewards(_addr, self.totalSupply)
    claimable = ERC20(_token).balanceOf(_addr) - claimable

    integral: uint256 = self.reward_integral[_token]
    integral_for: uint256 = self.reward_integral_for[_token][_addr]

    if integral_for < integral:
        claimable += self.balanceOf[_addr] * (integral - integral_for) / 10**18

    return claimable


@external
@nonreentrant('lock')
def claim_rewards(_addr: address = msg.sender):
    """
    @notice Claim available reward tokens for `_addr`
    @param _addr Address to claim for
    """
    self._checkpoint_rewards(_addr, self.totalSupply)


@external
@nonreentrant('lock')
def claim_historic_rewards(_reward_tokens: address[MAX_REWARDS], _addr: address = msg.sender):
    """
    @notice Claim reward tokens available from a previously-set staking contract
    @param _reward_tokens Array of reward token addresses to claim
    @param _addr Address to claim for
    """
    for token in _reward_tokens:
        if token == ZERO_ADDRESS:
            break
        integral: uint256 = self.reward_integral[token]
        integral_for: uint256 = self.reward_integral_for[token][_addr]

        if integral_for < integral:
            claimable: uint256 = self.balanceOf[_addr] * (integral - integral_for) / 10**18
            self.reward_integral_for[token][_addr] = integral
            response: Bytes[32] = raw_call(
                token,
                concat(
                    method_id("transfer(address,uint256)"),
                    convert(_addr, bytes32),
                    convert(claimable, bytes32),
                ),
                max_outsize=32,
            )
            if len(response) != 0:
                assert convert(response, bool)


@external
def kick(addr: address):
    """
    @notice Kick `addr` for abusing their boost
    @dev Only if either they had another voting event, or their voting escrow lock expired
    @param addr Address to kick
    """
    _voting_escrow: address = self.voting_escrow
    t_last: uint256 = self.integrate_checkpoint_of[addr]
    t_ve: uint256 = VotingEscrow(_voting_escrow).user_point_history__ts(
        addr, VotingEscrow(_voting_escrow).user_point_epoch(addr)
    )
    _balance: uint256 = self.balanceOf[addr]

    assert ERC20(self.voting_escrow).balanceOf(addr) == 0 or t_ve > t_last # dev: kick not allowed
    assert self.working_balances[addr] > _balance * TOKENLESS_PRODUCTION / 100  # dev: kick not needed

    self._checkpoint(addr)
    self._update_liquidity_limit(addr, self.balanceOf[addr], self.totalSupply)


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
def deposit(_value: uint256, _addr: address = msg.sender):
    """
    @notice Deposit `_value` LP tokens
    @dev Depositting also claims pending reward tokens
    @param _value Number of tokens to deposit
    @param _addr Address to deposit for
    """
    if _addr != msg.sender:
        assert self.approved_to_deposit[msg.sender][_addr], "Not approved"

    self._checkpoint(_addr)

    if _value != 0:
        reward_contract: address = self.reward_contract
        total_supply: uint256 = self.totalSupply
        if reward_contract != ZERO_ADDRESS:
            self._checkpoint_rewards(_addr, total_supply)

        total_supply += _value
        new_balance: uint256 = self.balanceOf[_addr] + _value
        self.balanceOf[_addr] = new_balance
        self.totalSupply = total_supply

        self._update_liquidity_limit(_addr, new_balance, total_supply)

        ERC20(self.lp_token).transferFrom(msg.sender, self, _value)
        if reward_contract != ZERO_ADDRESS:
            deposit_sig: Bytes[4] = slice(self.reward_sigs, 0, 4)
            if convert(deposit_sig, uint256) != 0:
                raw_call(
                    reward_contract,
                    concat(deposit_sig, convert(_value, bytes32))
                )

    log Deposit(_addr, _value)
    log Transfer(ZERO_ADDRESS, _addr, _value)


@external
@nonreentrant('lock')
def withdraw(_value: uint256):
    """
    @notice Withdraw `_value` LP tokens
    @dev Withdrawing also claims pending reward tokens
    @param _value Number of tokens to withdraw
    """
    self._checkpoint(msg.sender)

    if _value != 0:
        reward_contract: address = self.reward_contract
        total_supply: uint256 = self.totalSupply
        if reward_contract != ZERO_ADDRESS:
            self._checkpoint_rewards(msg.sender, total_supply)

        total_supply -= _value
        new_balance: uint256 = self.balanceOf[msg.sender] - _value
        self.balanceOf[msg.sender] = new_balance
        self.totalSupply = total_supply

        self._update_liquidity_limit(msg.sender, new_balance, total_supply)

        if reward_contract != ZERO_ADDRESS:
            withdraw_sig: Bytes[4] = slice(self.reward_sigs, 4, 4)
            if convert(withdraw_sig, uint256) != 0:
                raw_call(
                    reward_contract,
                    concat(withdraw_sig, convert(_value, bytes32))
                )
        ERC20(self.lp_token).transfer(msg.sender, _value)

    log Withdraw(msg.sender, _value)
    log Transfer(msg.sender, ZERO_ADDRESS, _value)


@view
@external
def allowance(_owner : address, _spender : address) -> uint256:
    """
    @notice Check the amount of tokens that an owner allowed to a spender
    @param _owner The address which owns the funds
    @param _spender The address which will spend the funds
    @return uint256 Amount of tokens still available for the spender
    """
    return self.allowances[_owner][_spender]


@internal
def _transfer(_from: address, _to: address, _value: uint256):
    self._checkpoint(_from)
    self._checkpoint(_to)
    reward_contract: address = self.reward_contract

    if _value != 0:
        total_supply: uint256 = self.totalSupply
        if reward_contract != ZERO_ADDRESS:
            self._checkpoint_rewards(_from, total_supply)
        new_balance: uint256 = self.balanceOf[_from] - _value
        self.balanceOf[_from] = new_balance
        self._update_liquidity_limit(_from, new_balance, total_supply)

        if reward_contract != ZERO_ADDRESS:
            self._checkpoint_rewards(_to, total_supply)
        new_balance = self.balanceOf[_to] + _value
        self.balanceOf[_to] = new_balance
        self._update_liquidity_limit(_to, new_balance, total_supply)

    log Transfer(_from, _to, _value)


@external
@nonreentrant('lock')
def transfer(_to : address, _value : uint256) -> bool:
    """
    @notice Transfer token for a specified address
    @dev Transferring claims pending reward tokens for the sender and receiver
    @param _to The address to transfer to.
    @param _value The amount to be transferred.
    """
    self._transfer(msg.sender, _to, _value)

    return True


@external
@nonreentrant('lock')
def transferFrom(_from : address, _to : address, _value : uint256) -> bool:
    """
     @notice Transfer tokens from one address to another.
     @dev Transferring claims pending reward tokens for the sender and receiver
     @param _from address The address which you want to send tokens from
     @param _to address The address which you want to transfer to
     @param _value uint256 the amount of tokens to be transferred
    """
    _allowance: uint256 = self.allowances[_from][msg.sender]
    if _allowance != MAX_UINT256:
        self.allowances[_from][msg.sender] = _allowance - _value

    self._transfer(_from, _to, _value)

    return True


@external
def approve(_spender : address, _value : uint256) -> bool:
    """
    @notice Approve the passed address to transfer the specified amount of
            tokens on behalf of msg.sender
    @dev Beware that changing an allowance via this method brings the risk
         that someone may use both the old and new allowance by unfortunate
         transaction ordering. This may be mitigated with the use of
         {incraseAllowance} and {decreaseAllowance}.
         https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
    @param _spender The address which will transfer the funds
    @param _value The amount of tokens that may be transferred
    @return bool success
    """
    self.allowances[msg.sender][_spender] = _value
    log Approval(msg.sender, _spender, _value)

    return True


@external
def increaseAllowance(_spender: address, _added_value: uint256) -> bool:
    """
    @notice Increase the allowance granted to `_spender` by the caller
    @dev This is alternative to {approve} that can be used as a mitigation for
         the potential race condition
    @param _spender The address which will transfer the funds
    @param _added_value The amount of to increase the allowance
    @return bool success
    """
    allowance: uint256 = self.allowances[msg.sender][_spender] + _added_value
    self.allowances[msg.sender][_spender] = allowance

    log Approval(msg.sender, _spender, allowance)

    return True


@external
def decreaseAllowance(_spender: address, _subtracted_value: uint256) -> bool:
    """
    @notice Decrease the allowance granted to `_spender` by the caller
    @dev This is alternative to {approve} that can be used as a mitigation for
         the potential race condition
    @param _spender The address which will transfer the funds
    @param _subtracted_value The amount of to decrease the allowance
    @return bool success
    """
    allowance: uint256 = self.allowances[msg.sender][_spender] - _subtracted_value
    self.allowances[msg.sender][_spender] = allowance

    log Approval(msg.sender, _spender, allowance)

    return True


@external
@nonreentrant('lock')
def set_rewards(_reward_contract: address, _sigs: bytes32, _reward_tokens: address[MAX_REWARDS]):
    """
    @notice Set the active reward contract
    @dev A reward contract cannot be set while this contract has no deposits
    @param _reward_contract Reward contract address. Set to ZERO_ADDRESS to
                            disable staking.
    @param _sigs Four byte selectors for staking, withdrawing and claiming,
                 right padded with zero bytes. If the reward contract can
                 be claimed from but does not require staking, the staking
                 and withdraw selectors should be set to 0x00
    @param _reward_tokens List of claimable tokens for this reward contract
    """
    assert msg.sender == self.admin

    lp_token: address = self.lp_token
    current_reward_contract: address = self.reward_contract
    total_supply: uint256 = self.totalSupply
    if current_reward_contract != ZERO_ADDRESS:
        self._checkpoint_rewards(ZERO_ADDRESS, total_supply)
        withdraw_sig: Bytes[4] = slice(self.reward_sigs, 4, 4)
        if convert(withdraw_sig, uint256) != 0:
            if total_supply != 0:
                raw_call(
                    current_reward_contract,
                    concat(withdraw_sig, convert(total_supply, bytes32))
                )
            ERC20(lp_token).approve(current_reward_contract, 0)

    if _reward_contract != ZERO_ADDRESS:
        assert _reward_contract.is_contract  # dev: not a contract
        sigs: bytes32 = _sigs
        deposit_sig: Bytes[4] = slice(sigs, 0, 4)
        withdraw_sig: Bytes[4] = slice(sigs, 4, 4)

        if convert(deposit_sig, uint256) != 0:
            # need a non-zero total supply to verify the sigs
            assert total_supply != 0  # dev: zero total supply
            ERC20(lp_token).approve(_reward_contract, MAX_UINT256)

            # it would be Very Bad if we get the signatures wrong here, so
            # we do a test deposit and withdrawal prior to setting them
            raw_call(
                _reward_contract,
                concat(deposit_sig, convert(total_supply, bytes32))
            )  # dev: failed deposit
            assert ERC20(lp_token).balanceOf(self) == 0
            raw_call(
                _reward_contract,
                concat(withdraw_sig, convert(total_supply, bytes32))
            )  # dev: failed withdraw
            assert ERC20(lp_token).balanceOf(self) == total_supply

            # deposit and withdraw are good, time to make the actual deposit
            raw_call(
                _reward_contract,
                concat(deposit_sig, convert(total_supply, bytes32))
            )
        else:
            assert convert(withdraw_sig, uint256) == 0  # dev: withdraw without deposit

    self.reward_contract = _reward_contract
    self.reward_sigs = _sigs
    for i in range(MAX_REWARDS):
        if _reward_tokens[i] != ZERO_ADDRESS:
            self.reward_tokens[i] = _reward_tokens[i]
        elif self.reward_tokens[i] != ZERO_ADDRESS:
            self.reward_tokens[i] = ZERO_ADDRESS
        else:
            assert i != 0  # dev: no reward token
            break

    if _reward_contract != ZERO_ADDRESS:
        # do an initial checkpoint to verify that claims are working
        self._checkpoint_rewards(ZERO_ADDRESS, total_supply)


@external
def set_killed(_is_killed: bool):
    """
    @notice Set the killed status for this contract
    @dev When killed, the gauge always yields a rate of 0 and so cannot mint CRV
    @param _is_killed Killed status to set
    """
    assert msg.sender == self.admin

    self.is_killed = _is_killed


@external
def commit_transfer_ownership(addr: address):
    """
    @notice Transfer ownership of GaugeController to `addr`
    @param addr Address to have ownership transferred to
    """
    assert msg.sender == self.admin  # dev: admin only

    self.future_admin = addr
    log CommitOwnership(addr)


@external
def accept_transfer_ownership():
    """
    @notice Accept a pending ownership transfer
    """
    _admin: address = self.future_admin
    assert msg.sender == _admin  # dev: future admin only

    self.admin = _admin
    log ApplyOwnership(_admin)
