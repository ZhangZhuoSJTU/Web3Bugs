# @version 0.2.4
"""
@title Staking Liquidity Gauge
@author Curve Finance
@license MIT
@notice Simultaneously stakes using Synthetix (== YFI) rewards contract
"""

from vyper.interfaces import ERC20

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

interface CurveRewards:
    def stake(amount: uint256): nonpayable
    def withdraw(amount: uint256): nonpayable
    def getReward(): nonpayable
    def earned(addr: address) -> uint256: view


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


TOKENLESS_PRODUCTION: constant(uint256) = 40
BOOST_WARMUP: constant(uint256) = 2 * 7 * 86400
WEEK: constant(uint256) = 604800

minter: public(address)
crv_token: public(address)
lp_token: public(address)
controller: public(address)
voting_escrow: public(address)
balanceOf: public(HashMap[address, uint256])
totalSupply: public(uint256)
future_epoch_time: public(uint256)

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
rewarded_token: public(address)

reward_integral: public(uint256)
reward_integral_for: public(HashMap[address, uint256])
rewards_for: public(HashMap[address, uint256])
claimed_rewards_for: public(HashMap[address, uint256])


@external
def __init__(lp_addr: address, _minter: address, _reward_contract: address, _rewarded_token: address):
    """
    @notice Contract constructor
    @param lp_addr Liquidity Pool contract address
    @param _minter Minter contract address
    @param _reward_contract Synthetix reward contract address
    @param _rewarded_token Received synthetix token contract address
    """
    assert lp_addr != ZERO_ADDRESS
    assert _minter != ZERO_ADDRESS
    assert _reward_contract != ZERO_ADDRESS

    self.lp_token = lp_addr
    self.minter = _minter
    crv_addr: address = Minter(_minter).token()
    self.crv_token = crv_addr
    controller_addr: address = Minter(_minter).controller()
    self.controller = controller_addr
    self.voting_escrow = Controller(controller_addr).voting_escrow()
    self.period_timestamp[0] = block.timestamp
    self.inflation_rate = CRV20(crv_addr).rate()
    self.future_epoch_time = CRV20(crv_addr).future_epoch_time_write()
    self.reward_contract = _reward_contract
    assert ERC20(lp_addr).approve(_reward_contract, MAX_UINT256)
    self.rewarded_token = _rewarded_token


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
    if (voting_total > 0) and (block.timestamp > self.period_timestamp[0] + BOOST_WARMUP):
        lim += L * voting_balance / voting_total * (100 - TOKENLESS_PRODUCTION) / 100

    lim = min(l, lim)
    old_bal: uint256 = self.working_balances[addr]
    self.working_balances[addr] = lim
    _working_supply: uint256 = self.working_supply + lim - old_bal
    self.working_supply = _working_supply

    log UpdateLiquidityLimit(addr, l, L, lim, _working_supply)


@internal
def _checkpoint_rewards(addr: address, claim_rewards: bool):
    # Update reward integrals (no gauge weights involved: easy)
    _rewarded_token: address = self.rewarded_token

    d_reward: uint256 = 0
    if claim_rewards:
        d_reward = ERC20(_rewarded_token).balanceOf(self)
        CurveRewards(self.reward_contract).getReward()
        d_reward = ERC20(_rewarded_token).balanceOf(self) - d_reward

    user_balance: uint256 = self.balanceOf[addr]
    total_balance: uint256 = self.totalSupply
    dI: uint256 = 0
    if total_balance > 0:
        dI = 10 ** 18 * d_reward / total_balance
    I: uint256 = self.reward_integral + dI
    self.reward_integral = I
    self.rewards_for[addr] += user_balance * (I - self.reward_integral_for[addr]) / 10 ** 18
    self.reward_integral_for[addr] = I


@internal
def _checkpoint(addr: address, claim_rewards: bool):
    """
    @notice Checkpoint for a user
    @param addr User address
    """
    _token: address = self.crv_token
    _controller: address = self.controller
    _period: int128 = self.period
    _period_time: uint256 = self.period_timestamp[_period]
    _integrate_inv_supply: uint256 = self.integrate_inv_supply[_period]
    rate: uint256 = self.inflation_rate
    new_rate: uint256 = rate
    prev_future_epoch: uint256 = self.future_epoch_time
    if prev_future_epoch >= _period_time:
        self.future_epoch_time = CRV20(_token).future_epoch_time_write()
        new_rate = CRV20(_token).rate()
        self.inflation_rate = new_rate
    Controller(_controller).checkpoint_gauge(self)

    _working_balance: uint256 = self.working_balances[addr]
    _working_supply: uint256 = self.working_supply

    # Update integral of 1/supply
    if block.timestamp > _period_time:
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
    self.integrate_fraction[addr] += _working_balance * (_integrate_inv_supply - self.integrate_inv_supply_of[addr]) / 10 ** 18
    self.integrate_inv_supply_of[addr] = _integrate_inv_supply
    self.integrate_checkpoint_of[addr] = block.timestamp

    self._checkpoint_rewards(addr, claim_rewards)


@external
def user_checkpoint(addr: address) -> bool:
    """
    @notice Record a checkpoint for `addr`
    @param addr User address
    @return bool success
    """
    assert (msg.sender == addr) or (msg.sender == self.minter)  # dev: unauthorized
    self._checkpoint(addr, True)
    self._update_liquidity_limit(addr, self.balanceOf[addr], self.totalSupply)
    return True


@external
def claimable_tokens(addr: address) -> uint256:
    """
    @notice Get the number of claimable tokens per user
    @dev This function should be manually changed to "view" in the ABI
    @return uint256 number of claimable tokens per user
    """
    self._checkpoint(addr, True)
    return self.integrate_fraction[addr] - Minter(self.minter).minted(addr, self)


@external
@view
def claimable_reward(addr: address) -> uint256:
    """
    @notice Get the number of claimable reward tokens for a user
    @param addr Account to get reward amount for
    @return uint256 Claimable reward token amount
    """
    d_reward: uint256 = CurveRewards(self.reward_contract).earned(self)

    user_balance: uint256 = self.balanceOf[addr]
    total_balance: uint256 = self.totalSupply
    dI: uint256 = 0
    if total_balance > 0:
        dI = 10 ** 18 * d_reward / total_balance
    I: uint256 = self.reward_integral + dI

    return self.rewards_for[addr] + user_balance * (I - self.reward_integral_for[addr]) / 10 ** 18


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

    self._checkpoint(addr, True)
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
def deposit(_value: uint256, addr: address = msg.sender):
    """
    @notice Deposit `_value` LP tokens
    @param _value Number of tokens to deposit
    @param addr Address to deposit for
    """
    if addr != msg.sender:
        assert self.approved_to_deposit[msg.sender][addr], "Not approved"

    self._checkpoint(addr, True)

    if _value != 0:
        _balance: uint256 = self.balanceOf[addr] + _value
        _supply: uint256 = self.totalSupply + _value
        self.balanceOf[addr] = _balance
        self.totalSupply = _supply

        self._update_liquidity_limit(addr, _balance, _supply)

        assert ERC20(self.lp_token).transferFrom(msg.sender, self, _value)
        CurveRewards(self.reward_contract).stake(_value)

    log Deposit(addr, _value)


@external
@nonreentrant('lock')
def withdraw(_value: uint256, claim_rewards: bool = True):
    """
    @notice Withdraw `_value` LP tokens
    @param _value Number of tokens to withdraw
    """
    self._checkpoint(msg.sender, claim_rewards)

    _balance: uint256 = self.balanceOf[msg.sender] - _value
    _supply: uint256 = self.totalSupply - _value
    self.balanceOf[msg.sender] = _balance
    self.totalSupply = _supply

    self._update_liquidity_limit(msg.sender, _balance, _supply)

    if _value > 0:
        CurveRewards(self.reward_contract).withdraw(_value)
        assert ERC20(self.lp_token).transfer(msg.sender, _value)

    log Withdraw(msg.sender, _value)


@external
@nonreentrant('lock')
def claim_rewards(addr: address = msg.sender):
    self._checkpoint_rewards(addr, True)
    _rewards_for: uint256 = self.rewards_for[addr]
    assert ERC20(self.rewarded_token).transfer(
        addr, _rewards_for - self.claimed_rewards_for[addr])
    self.claimed_rewards_for[addr] = _rewards_for


@external
@view
def integrate_checkpoint() -> uint256:
    return self.period_timestamp[self.period]
