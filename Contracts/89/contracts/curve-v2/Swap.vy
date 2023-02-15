# @version 0.2.12
# (c) Curve.Fi, 2021
# Pool for USDT/BTC/ETH or similar

interface ERC20:  # Custom ERC20 which works for USDT, WETH and WBTC
    def transfer(_to: address, _amount: uint256): nonpayable
    def transferFrom(_from: address, _to: address, _amount: uint256): nonpayable
    def balanceOf(_user: address) -> uint256: view

interface CurveToken:
    def totalSupply() -> uint256: view
    def mint(_to: address, _value: uint256) -> bool: nonpayable
    def mint_relative(_to: address, frac: uint256) -> uint256: nonpayable
    def burnFrom(_to: address, _value: uint256) -> bool: nonpayable


interface Math:
    def geometric_mean(unsorted_x: uint256[N_COINS]) -> uint256: view
    def newton_D(ANN: uint256, gamma: uint256, x_unsorted: uint256[N_COINS]) -> uint256: view
    def newton_y(ANN: uint256, gamma: uint256, x: uint256[N_COINS], D: uint256, i: uint256) -> uint256: view
    def halfpow(power: uint256, precision: uint256) -> uint256: view
    def sqrt_int(x: uint256) -> uint256: view


interface Views:
    def get_dy(i: uint256, j: uint256, dx: uint256, balances: uint256[N_COINS], D: uint256) -> (uint256, uint256): view
    def get_dx(i: uint256, j: uint256, dy: uint256, balances: uint256[N_COINS], D: uint256) -> (uint256, uint256): view
    def calc_token_amount(amounts: uint256[N_COINS], deposit: bool) -> uint256: view


interface WETH:
    def deposit(): payable
    def withdraw(_amount: uint256): nonpayable


# Events
event TokenExchange:
    buyer: indexed(address)
    sold_id: uint256
    tokens_sold: uint256
    bought_id: uint256
    tokens_bought: uint256
    trade_fee: uint256

event AddLiquidity:
    provider: indexed(address)
    token_amounts: uint256[N_COINS]
    fee: uint256
    token_supply: uint256

event RemoveLiquidity:
    provider: indexed(address)
    token_amounts: uint256[N_COINS]
    token_supply: uint256

event RemoveLiquidityOne:
    provider: indexed(address)
    token_amount: uint256
    coin_index: uint256
    coin_amount: uint256

event CommitNewAdmin:
    deadline: indexed(uint256)
    admin: indexed(address)

event NewAdmin:
    admin: indexed(address)

event CommitNewParameters:
    deadline: indexed(uint256)
    admin_fee: uint256
    mid_fee: uint256
    out_fee: uint256
    fee_gamma: uint256
    allowed_extra_profit: uint256
    adjustment_step: uint256
    ma_half_time: uint256

event NewParameters:
    admin_fee: uint256
    mid_fee: uint256
    out_fee: uint256
    fee_gamma: uint256
    allowed_extra_profit: uint256
    adjustment_step: uint256
    ma_half_time: uint256

event RampAgamma:
    initial_A: uint256
    future_A: uint256
    initial_gamma: uint256
    future_gamma: uint256
    initial_time: uint256
    future_time: uint256

event StopRampA:
    current_A: uint256
    current_gamma: uint256
    time: uint256

event ClaimAdminFee:
    admin: indexed(address)
    tokens: uint256


N_COINS: constant(int128) = 2  # <- change
PRECISION: constant(uint256) = 10 ** 18  # The precision to convert to
A_MULTIPLIER: constant(uint256) = 10000

# These addresses are replaced by the deployer
math: address
views: address
amm: address
totalSupply: public(uint256)
token: address

price_scale: public(uint256)   # Internal price scale
price_oracle: public(uint256)  # Price target given by MA

last_prices: public(uint256)
last_prices_timestamp: public(uint256)

initial_A_gamma: public(uint256)
future_A_gamma: public(uint256)
initial_A_gamma_time: public(uint256)
future_A_gamma_time: public(uint256)

allowed_extra_profit: public(uint256)  # 2 * 10**12 - recommended value
future_allowed_extra_profit: public(uint256)

fee_gamma: public(uint256)
future_fee_gamma: public(uint256)

adjustment_step: public(uint256)
future_adjustment_step: public(uint256)

ma_half_time: public(uint256)
future_ma_half_time: public(uint256)

mid_fee: public(uint256)
out_fee: public(uint256)
admin_fee: public(uint256)
future_mid_fee: public(uint256)
future_out_fee: public(uint256)
future_admin_fee: public(uint256)

balances: public(uint256[N_COINS])
D: public(uint256)

owner: public(address)
future_owner: public(address)

xcp_profit: public(uint256)
xcp_profit_a: public(uint256)  # Full profit at last claim of admin fees
virtual_price: public(uint256)  # Cached (fast to read) virtual price also used internally
not_adjusted: bool

is_killed: public(bool)
kill_deadline: public(uint256)
transfer_ownership_deadline: public(uint256)
admin_actions_deadline: public(uint256)

KILL_DEADLINE_DT: constant(uint256) = 2 * 30 * 86400
ADMIN_ACTIONS_DELAY: constant(uint256) = 3 * 86400
MIN_RAMP_TIME: constant(uint256) = 86400

MAX_ADMIN_FEE: constant(uint256) = 10 * 10 ** 9
MIN_FEE: constant(uint256) = 5 * 10 ** 5  # 0.5 bps
MAX_FEE: constant(uint256) = 10 * 10 ** 9
MAX_A: constant(uint256) = 10000 * A_MULTIPLIER * N_COINS**N_COINS
MAX_A_CHANGE: constant(uint256) = 10
MIN_GAMMA: constant(uint256) = 10**10
MAX_GAMMA: constant(uint256) = 10**16
NOISE_FEE: constant(uint256) = 10**5  # 0.1 bps

# This must be changed for different N_COINS
# For example:
# N_COINS = 3 -> 1  (10**18 -> 10**18)
# N_COINS = 4 -> 10**8  (10**18 -> 10**10)
# PRICE_PRECISION_MUL: constant(uint256) = 1
PRECISIONS: constant(uint256[N_COINS]) = [
    10**12,
    1,
]

INF_COINS: constant(uint256) = 15
isInitialized: bool


@external
def initialize (
    owner: address,
    math: address,
    views: address,
    A: uint256,
    gamma: uint256,
    mid_fee: uint256,
    out_fee: uint256,
    allowed_extra_profit: uint256,
    fee_gamma: uint256,
    adjustment_step: uint256,
    admin_fee: uint256,
    ma_half_time: uint256,
    initial_price: uint256
):
    assert not self.isInitialized, "VAMM: contract is already initialized"
    self.math = math
    self.views = views
    self.totalSupply = 0

    self.owner = owner

    # Pack A and gamma:
    # shifted A + gamma
    A_gamma: uint256 = shift(A, 128)
    A_gamma = bitwise_or(A_gamma, gamma)
    self.initial_A_gamma = A_gamma
    self.future_A_gamma = A_gamma

    self.mid_fee = mid_fee
    self.out_fee = out_fee
    self.allowed_extra_profit = allowed_extra_profit
    self.fee_gamma = fee_gamma
    self.adjustment_step = adjustment_step
    self.admin_fee = admin_fee

    self.price_scale = initial_price
    self.price_oracle = initial_price
    self.last_prices = initial_price
    self.last_prices_timestamp = block.timestamp
    self.ma_half_time = ma_half_time
    self.xcp_profit_a = 10**18
    self.kill_deadline = block.timestamp + KILL_DEADLINE_DT
    self.isInitialized = True

@payable
@external
def __default__():
    pass

@internal
@view
def xp() -> uint256[N_COINS]:
    return [self.balances[0] * PRECISIONS[0],
            self.balances[1] * PRECISIONS[1] * self.price_scale / PRECISION]


@view
@internal
def _A_gamma() -> uint256[2]:
    t1: uint256 = self.future_A_gamma_time

    A_gamma_1: uint256 = self.future_A_gamma
    gamma1: uint256 = bitwise_and(A_gamma_1, 2**128-1)
    A1: uint256 = shift(A_gamma_1, -128)

    if block.timestamp < t1:
        # handle ramping up and down of A
        A_gamma_0: uint256 = self.initial_A_gamma
        t0: uint256 = self.initial_A_gamma_time

        # Less readable but more compact way of writing and converting to uint256
        # gamma0: uint256 = bitwise_and(A_gamma_0, 2**128-1)
        # A0: uint256 = shift(A_gamma_0, -128)
        # A1 = A0 + (A1 - A0) * (block.timestamp - t0) / (t1 - t0)
        # gamma1 = gamma0 + (gamma1 - gamma0) * (block.timestamp - t0) / (t1 - t0)

        t1 -= t0
        t0 = block.timestamp - t0
        t2: uint256 = t1 - t0

        A1 = (shift(A_gamma_0, -128) * t2 + A1 * t0) / t1
        gamma1 = (bitwise_and(A_gamma_0, 2**128-1) * t2 + gamma1 * t0) / t1

    return [A1, gamma1]


@view
@external
def A() -> uint256:
    return self._A_gamma()[0]


@view
@external
def gamma() -> uint256:
    return self._A_gamma()[1]


@internal
@view
def _fee(xp: uint256[N_COINS]) -> uint256:
    return self.mid_fee


@external
@view
def fee() -> uint256:
    return self._fee(self.xp())


@external
@view
def fee_calc(xp: uint256[N_COINS]) -> uint256:
    return self._fee(xp)


@internal
@view
def get_xcp(D: uint256) -> uint256:
    x: uint256[N_COINS] = [D / N_COINS, D * PRECISION / (self.price_scale * N_COINS)]
    return Math(self.math).geometric_mean(x)


@external
@view
def get_virtual_price() -> uint256:
    return 10**18 * self.get_xcp(self.D) / self.totalSupply


@internal
def tweak_price(A_gamma: uint256[2],
                _xp: uint256[N_COINS], p_i: uint256,
                new_D: uint256):
    price_oracle: uint256 = self.price_oracle
    last_prices: uint256 = self.last_prices
    price_scale: uint256 = self.price_scale
    last_prices_timestamp: uint256 = self.last_prices_timestamp
    p_new: uint256 = 0

    if last_prices_timestamp < block.timestamp:
        # MA update required
        ma_half_time: uint256 = self.ma_half_time
        alpha: uint256 = Math(self.math).halfpow((block.timestamp - last_prices_timestamp) * 10**18 / ma_half_time, 10**10)
        price_oracle = (last_prices * (10**18 - alpha) + price_oracle * alpha) / 10**18
        self.price_oracle = price_oracle
        self.last_prices_timestamp = block.timestamp

    D_unadjusted: uint256 = new_D  # Withdrawal methods know new D already
    if new_D == 0:
        # We will need this a few times (35k gas)
        D_unadjusted = Math(self.math).newton_D(A_gamma[0], A_gamma[1], _xp)

    if p_i > 0:
        last_prices = p_i

    else:
        # calculate real prices
        __xp: uint256[N_COINS] = _xp
        dx_price: uint256 = __xp[0] / 10**6
        __xp[0] += dx_price
        last_prices = price_scale * dx_price / (_xp[1] - Math(self.math).newton_y(A_gamma[0], A_gamma[1], __xp, D_unadjusted, 1))

    self.last_prices = last_prices

    total_supply: uint256 = self.totalSupply
    old_xcp_profit: uint256 = self.xcp_profit
    old_virtual_price: uint256 = self.virtual_price

    # Update profit numbers without price adjustment first
    xp: uint256[N_COINS] = [D_unadjusted / N_COINS, D_unadjusted * PRECISION / (N_COINS * price_scale)]
    xcp_profit: uint256 = 10**18
    virtual_price: uint256 = 10**18

    if old_virtual_price > 0:
        xcp: uint256 = Math(self.math).geometric_mean(xp)
        virtual_price = 10**18 * xcp / total_supply
        xcp_profit = old_xcp_profit * virtual_price / old_virtual_price

        t: uint256 = self.future_A_gamma_time
        if virtual_price < old_virtual_price and t == 0:
            raise "Loss"
        if t == 1:
            self.future_A_gamma_time = 0

    self.xcp_profit = xcp_profit

    norm: uint256 = price_oracle * 10**18 / price_scale
    if norm > 10**18:
        norm -= 10**18
    else:
        norm = 10**18 - norm
    adjustment_step: uint256 = max(self.adjustment_step, norm / 10)

    needs_adjustment: bool = self.not_adjusted
    # if not needs_adjustment and (virtual_price-10**18 > (xcp_profit-10**18)/2 + self.allowed_extra_profit):
    # (re-arrange for gas efficiency)
    if not needs_adjustment and (virtual_price * 2 - 10**18 > xcp_profit + 2*self.allowed_extra_profit) and (norm > adjustment_step) and (old_virtual_price > 0):
        needs_adjustment = True
        self.not_adjusted = True

    if needs_adjustment:
        if norm > adjustment_step and old_virtual_price > 0:
            p_new = (price_scale * (norm - adjustment_step) + adjustment_step * price_oracle) / norm

            # Calculate balances*prices
            xp = [_xp[0], _xp[1] * p_new / price_scale]

            # Calculate "extended constant product" invariant xCP and virtual price
            D: uint256 = Math(self.math).newton_D(A_gamma[0], A_gamma[1], xp)
            xp = [D / N_COINS, D * PRECISION / (N_COINS * p_new)]
            # We reuse old_virtual_price here but it's not old anymore
            old_virtual_price = 10**18 * Math(self.math).geometric_mean(xp) / total_supply

            # Proceed if we've got enough profit
            # if (old_virtual_price > 10**18) and (2 * (old_virtual_price - 10**18) > xcp_profit - 10**18):
            if (old_virtual_price > 10**18) and (2 * old_virtual_price - 10**18 > xcp_profit):
                self.price_scale = p_new
                self.D = D
                self.virtual_price = old_virtual_price

                return

            else:
                self.not_adjusted = False

                # Can instead do another flag variable if we want to save bytespace
                self.D = D_unadjusted
                self.virtual_price = virtual_price
                return

    # If we are here, the price_scale adjustment did not happen
    # Still need to update the profit counter and D
    self.D = D_unadjusted
    self.virtual_price = virtual_price

    # norm appeared < adjustment_step after
    if needs_adjustment:
        self.not_adjusted = False


# @payable
@external
@nonreentrant('lock')
def exchange(i: uint256, j: uint256, dx: uint256, min_dy: uint256) -> (uint256, uint256):
    assert msg.sender == self.amm, 'VAMM: OnlyAMM'
    assert not self.is_killed  # dev: the pool is killed
    assert i != j  # dev: coin index out of range
    assert i < N_COINS  # dev: coin index out of range
    assert j < N_COINS  # dev: coin index out of range
    assert dx > 0  # dev: do not exchange 0 coins

    A_gamma: uint256[2] = self._A_gamma()
    xp: uint256[N_COINS] = self.balances
    p: uint256 = 0
    dy: uint256 = 0
    trade_fee: uint256 = 0

    if True:  # scope to reduce size of memory when making internal calls later
        # if i == 2 and use_eth:
        #     assert msg.value == dx  # dev: incorrect eth amount
        #     WETH(coins[2]).deposit(value=msg.value)
        # else:
        #     assert msg.value == 0  # dev: nonzero eth amount
        #     # assert might be needed for some tokens - removed one to save bytespace
        #     ERC20(_coins[i]).transferFrom(msg.sender, self, dx)

        y: uint256 = xp[j]
        x0: uint256 = xp[i]
        xp[i] = x0 + dx
        self.balances[i] = xp[i]

        price_scale: uint256 = self.price_scale

        xp = [xp[0] * PRECISIONS[0], xp[1] * price_scale * PRECISIONS[1] / PRECISION]

        prec_i: uint256 = PRECISIONS[0]
        prec_j: uint256 = PRECISIONS[1]
        if i == 1:
            prec_i = PRECISIONS[1]
            prec_j = PRECISIONS[0]

        # In case ramp is happening
        if True:
            t: uint256 = self.future_A_gamma_time
            if t > 0:
                x0 *= prec_i
                if i > 0:
                    x0 = x0 * price_scale / PRECISION
                x1: uint256 = xp[i]  # Back up old value in xp
                xp[i] = x0
                self.D = Math(self.math).newton_D(A_gamma[0], A_gamma[1], xp)
                xp[i] = x1  # And restore
                if block.timestamp >= t:
                    self.future_A_gamma_time = 1

        dy = xp[j] - Math(self.math).newton_y(A_gamma[0], A_gamma[1], xp, self.D, j)
        # Not defining new "y" here to have less variables / make subsequent calls cheaper
        xp[j] -= dy
        dy -= 1

        if j > 0:
            dy = dy * PRECISION / price_scale
        dy /= prec_j

        trade_fee = self._fee(xp) * dy / 10**10
        dy -= trade_fee
        assert dy >= min_dy, "Slippage"
        y -= dy

        self.balances[j] = y
        # assert might be needed for some tokens - removed one to save bytespace
        # if j == 2 and use_eth:
        #     WETH(coins[2]).withdraw(dy)
        #     raw_call(msg.sender, b"", value=dy)
        # else:
        #     ERC20(_coins[j]).transfer(msg.sender, dy)

        y *= prec_j
        if j > 0:
            y = y * price_scale / PRECISION
        xp[j] = y

        # Calculate price
        if dx > 10**5 and dy > 10**5:
            _dx: uint256 = dx * prec_i
            _dy: uint256 = dy * prec_j
            if i == 0:
                p = _dx * 10**18 / _dy
            else:  # j == 0
                p = _dy * 10**18 / _dx

    self.tweak_price(A_gamma, xp, p, 0)

    log TokenExchange(msg.sender, i, dx, j, dy, trade_fee)
    return dy, self.last_prices / PRECISIONS[0]

# @payable
@external
@nonreentrant('lock')
def exchangeExactOut(i: uint256, j: uint256, dy: uint256, max_dx: uint256) -> (uint256, uint256):
    assert msg.sender == self.amm, 'VAMM: OnlyAMM'
    assert not self.is_killed  # dev: the pool is killed
    assert i != j  # dev: coin index out of range
    assert i < N_COINS  # dev: coin index out of range
    assert j < N_COINS  # dev: coin index out of range
    assert dy > 0  # dev: do not exchange 0 coins

    A_gamma: uint256[2] = self._A_gamma()
    xp: uint256[N_COINS] = self.balances
    p: uint256 = 0
    dx: uint256 = 0
    trade_fee: uint256 = 0

    if True:  # scope to reduce size of memory when making internal calls later
        # if i == 2 and use_eth:
        #     assert msg.value == dx  # dev: incorrect eth amount
        #     WETH(coins[2]).deposit(value=msg.value)
        # else:
        #     assert msg.value == 0  # dev: nonzero eth amount
        #     # assert might be needed for some tokens - removed one to save bytespace
        #     ERC20(_coins[i]).transferFrom(msg.sender, self, dx)

        x: uint256 = xp[i]
        y0: uint256 = xp[j]
        xp[j] = y0 - dy
        self.balances[j] = xp[j]

        price_scale: uint256 = self.price_scale

        xp = [xp[0] * PRECISIONS[0], xp[1] * price_scale * PRECISIONS[1] / PRECISION]

        prec_i: uint256 = PRECISIONS[0]
        prec_j: uint256 = PRECISIONS[1]
        if i == 1:
            prec_i = PRECISIONS[1]
            prec_j = PRECISIONS[0]

        # In case ramp is happening
        if True:
            t: uint256 = self.future_A_gamma_time
            if t > 0:
                y0 *= prec_j
                if j > 0:
                    y0 = y0 * price_scale / PRECISION
                y1: uint256 = xp[j]  # Back up old value in xp
                xp[j] = y0
                self.D = Math(self.math).newton_D(A_gamma[0], A_gamma[1], xp)
                xp[j] = y1  # And restore
                if block.timestamp >= t:
                    self.future_A_gamma_time = 1

        dx =  Math(self.math).newton_y(A_gamma[0], A_gamma[1], xp, self.D, i) - xp[i]
        # Not defining new "x" here to have less variables / make subsequent calls cheaper
        xp[i] += dx
        dx += 1

        if i > 0:
            dx = dx * PRECISION / price_scale
        dx /= prec_i

        trade_fee = self._fee(xp) * dx / 10**10
        dx += trade_fee
        assert dx <= max_dx, "Slippage"
        x += dx

        self.balances[i] = x
        # assert might be needed for some tokens - removed one to save bytespace
        # if j == 2 and use_eth:
        #     WETH(coins[2]).withdraw(dy)
        #     raw_call(msg.sender, b"", value=dy)
        # else:
        #     ERC20(_coins[j]).transfer(msg.sender, dy)

        x *= prec_i
        if i > 0:
            x = x * price_scale / PRECISION
        xp[i] = x

        # Calculate price
        if dx > 10**5 and dy > 10**5:
            _dx: uint256 = dx * prec_i
            _dy: uint256 = dy * prec_j
            if i == 0:
                p = _dx * 10**18 / _dy
            else:  # j == 0
                p = _dy * 10**18 / _dx

    self.tweak_price(A_gamma, xp, p, 0)

    log TokenExchange(msg.sender, i, dx, j, dy, trade_fee)
    return dx, self.last_prices / PRECISIONS[0]

@external
@view
def get_dy(i: uint256, j: uint256, dx: uint256) -> uint256:
    return Views(self.views).get_dy(i, j, dx, self.balances, self.D)[0]

@external
@view
def get_dx(i: uint256, j: uint256, dy: uint256) -> uint256:
    return Views(self.views).get_dx(i, j, dy, self.balances, self.D)[0]

@external
@view
def get_dy_fee(i: uint256, j: uint256, dx: uint256) -> uint256:
    return Views(self.views).get_dy(i, j, dx, self.balances, self.D)[1]

@external
@view
def get_dx_fee(i: uint256, j: uint256, dy: uint256) -> uint256:
    return Views(self.views).get_dx(i, j, dy, self.balances, self.D)[1]

@view
@internal
def _calc_token_fee(amounts: uint256[N_COINS], xp: uint256[N_COINS]) -> uint256:
    # fee = sum(amounts_i - avg(amounts)) * fee' / sum(amounts)
    fee: uint256 = self._fee(xp) * N_COINS / (4 * (N_COINS-1))
    S: uint256 = 0
    for _x in amounts:
        S += _x
    avg: uint256 = S / N_COINS
    Sdiff: uint256 = 0
    for _x in amounts:
        if _x > avg:
            Sdiff += _x - avg
        else:
            Sdiff += avg - _x
    return fee * Sdiff / S + NOISE_FEE

@external
@view
def calc_token_fee(amounts: uint256[N_COINS], xp: uint256[N_COINS]) -> uint256:
    return self._calc_token_fee(amounts, xp)

@external
@nonreentrant('lock')
def add_liquidity(amounts: uint256[N_COINS], min_mint_amount: uint256) -> (uint256):
    assert msg.sender == self.amm, 'VAMM: OnlyAMM'
    assert not self.is_killed  # dev: the pool is killed
    assert msg.sender == self.amm

    A_gamma: uint256[2] = self._A_gamma()

    xp: uint256[N_COINS] = self.balances
    amountsp: uint256[N_COINS] = empty(uint256[N_COINS])
    xx: uint256[N_COINS] = empty(uint256[N_COINS])
    d_token: uint256 = 0
    d_token_fee: uint256 = 0
    old_D: uint256 = 0
    ix: uint256 = INF_COINS

    if True:  # Scope to avoid having extra variables in memory later
        xp_old: uint256[N_COINS] = xp

        for i in range(N_COINS):
            bal: uint256 = xp[i] + amounts[i]
            xp[i] = bal
            self.balances[i] = bal
        xx = xp

        price_scale: uint256 = self.price_scale * PRECISIONS[1]
        xp = [xp[0] * PRECISIONS[0], xp[1] * price_scale / PRECISION]
        xp_old = [xp_old[0] * PRECISIONS[0], xp_old[1] * price_scale / PRECISION]

        for i in range(N_COINS):
            if amounts[i] > 0:
                # assert might be needed for some tokens - removed one to save bytespace
                # ERC20(_coins[i]).transferFrom(msg.sender, self, amounts[i])
                amountsp[i] = xp[i] - xp_old[i]
                if ix == INF_COINS:
                    ix = i
                else:
                    ix = INF_COINS-1
        assert ix != INF_COINS  # dev: no coins to add

        t: uint256 = self.future_A_gamma_time
        if t > 0:
            old_D = Math(self.math).newton_D(A_gamma[0], A_gamma[1], xp_old)
            if block.timestamp >= t:
                self.future_A_gamma_time = 1
        else:
            old_D = self.D

    D: uint256 = Math(self.math).newton_D(A_gamma[0], A_gamma[1], xp)

    token_supply: uint256 = self.totalSupply
    if old_D > 0:
        d_token = token_supply * D / old_D - token_supply
    else:
        d_token = self.get_xcp(D)  # making initial virtual price equal to 1
    assert d_token > 0  # dev: nothing minted

    if old_D > 0:
        d_token_fee = self._calc_token_fee(amountsp, xp) * d_token / 10**10 + 1
        d_token -= d_token_fee
        token_supply += d_token
        self.totalSupply = token_supply
        # CurveToken(token).mint(msg.sender, d_token)

        # Calculate price
        # p_i * (dx_i - dtoken / token_supply * xx_i) = sum{k!=i}(p_k * (dtoken / token_supply * xx_k - dx_k))
        # Simplified for 2 coins
        p: uint256 = 0
        if d_token > 10**5:
            if amounts[0] == 0 or amounts[1] == 0:
                S: uint256 = 0
                precision: uint256 = 0
                ix = 0
                if amounts[0] == 0:
                    S = xx[0] * PRECISIONS[0]
                    precision = PRECISIONS[1]
                    ix = 1
                else:
                    S = xx[1] * PRECISIONS[1]
                    precision = PRECISIONS[0]
                S = S * d_token / token_supply
                p = S * PRECISION / (amounts[ix] * precision - d_token * xx[ix] * precision / token_supply)
                if ix == 0:
                    p = (10**18)**2 / p

        self.tweak_price(A_gamma, xp, p, D)

    else:
        self.D = D
        self.virtual_price = 10**18
        self.xcp_profit = 10**18
        self.totalSupply += d_token
        # CurveToken(token).mint(msg.sender, d_token)

    assert d_token >= min_mint_amount, "Slippage"

    log AddLiquidity(msg.sender, amounts, d_token_fee, self.totalSupply)
    return d_token

@internal
@pure
def _get_fee_adjusted_pnl(makerPosSize: int256, makerOpenNotional: int256) -> (int256, int256):
    unrealizedPnl: int256 = 0
    openNotional: int256 = makerOpenNotional

    if makerOpenNotional < 0:
        if makerPosSize > 0: # profit while removing liquidity
            unrealizedPnl = -makerOpenNotional
        elif makerPosSize < 0: # loss while removing liquidity
            unrealizedPnl = makerOpenNotional
        openNotional = 0
    elif makerOpenNotional > 0 and makerPosSize == 0: # when all positions are balanced but profit due to fee accumulation
        unrealizedPnl = makerOpenNotional
        openNotional = 0
    return unrealizedPnl, openNotional

@internal
@view
def _get_maker_position(amount: uint256, vUSD: uint256, vAsset: uint256, makerDToken: uint256) -> (int256, uint256, int256, uint256, uint256[N_COINS]):
    if amount == 0:
        return 0, 0, 0, self.D, self.balances

    total_supply: uint256 = self.totalSupply
    balances: uint256[N_COINS] = self.balances
    D: uint256 = self.D

    position: int256 = 0
    openNotional: int256 = 0
    feeAdjustedPnl: int256 = 0

    # the following leads to makers taking a slightly bigger position, hence commented out from original code
    # amount: uint256 = amount - 1  # Make rounding errors favoring other LPs a tiny bit
    d_balances: uint256[N_COINS] = empty(uint256[N_COINS])
    for x in range(N_COINS):
        d_balances[x] = balances[x] * amount / total_supply
        balances[x] -= d_balances[x]
    D = D - D * amount / total_supply

    position = convert(d_balances[N_COINS-1], int256)
    _vUSD: int256 = convert(vUSD, int256)
    if amount == makerDToken:
        position -= convert(vAsset, int256)
    else:
        position -= convert(vAsset * amount / makerDToken, int256)
        _vUSD = convert(vUSD * amount / makerDToken, int256)

    if position > 0:
        openNotional =  _vUSD - convert(d_balances[0], int256)
    elif position <= 0: # =0 when no position open but positive openNotional due to fee accumulation
        openNotional = convert(d_balances[0], int256) - _vUSD

    feeAdjustedPnl, openNotional = self._get_fee_adjusted_pnl(position, openNotional)
    return position, convert(openNotional, uint256), feeAdjustedPnl, D, balances

@internal
@pure
def _abs(x: int256) -> (int256):
    if x >= 0:
        return x
    else:
        return -x

@internal
@view
def _get_combined_open_notional(
        takerPosSize: int256,
        takerOpenNotional: uint256,
        makerPosSize: int256,
        makerOpenNotional: uint256
    ) -> (uint256):
    totalOpenNotional: uint256 = 0
    if makerPosSize * takerPosSize >= 0: # increasingPosition
        totalOpenNotional = takerOpenNotional + makerOpenNotional
    else: # reducePosition or reversePosition
        _openNotional: int256 = convert(takerOpenNotional, int256) - convert(makerOpenNotional, int256)
        totalOpenNotional = convert(self._abs(_openNotional), uint256)
    return totalOpenNotional

@external
@nonreentrant('lock')
def remove_liquidity(
        amount: uint256,
        min_amounts: uint256[N_COINS],
        vUSD: uint256,
        vAsset: uint256,
        makerDToken: uint256,
        takerPosSize: int256,
        takerOpenNotional: uint256
    ) -> (int256, uint256, int256, uint256[N_COINS]):
    """
    This withdrawal method is very safe, does no complex math
    """
    assert msg.sender == self.amm, 'VAMM: OnlyAMM'

    makerPosSize: int256 = 0
    makerOpenNotional: uint256 = 0
    totalOpenNotional: uint256 = 0
    feeAdjustedPnl: int256 = 0
    D: uint256 = 0
    balances: uint256[N_COINS] = empty(uint256[N_COINS])

    makerPosSize, makerOpenNotional, feeAdjustedPnl, D, balances = self._get_maker_position(amount, vUSD, vAsset, makerDToken)
    totalOpenNotional = self._get_combined_open_notional(takerPosSize, takerOpenNotional, makerPosSize, makerOpenNotional)

    d_balances: uint256[N_COINS] = self.balances
    for i in range(N_COINS):
        d_balances[i] -= balances[i]
        assert d_balances[i] >= min_amounts[i]

    self.balances = balances
    self.D = D
    self.totalSupply -= amount

    log RemoveLiquidity(msg.sender, d_balances, self.totalSupply)
    return makerPosSize, totalOpenNotional, feeAdjustedPnl, d_balances

@internal
@view
def _get_taker_notional_and_pnl(position: int256, openNotional: uint256, balances: uint256[N_COINS], D: uint256) -> (uint256, int256):
    notionalPosition: uint256 = 0
    unrealizedPnl: int256 = 0
    if D > 10**17 - 1:
        if position > 0:
            notionalPosition = Views(self.views).get_dy(1, 0, convert(position, uint256), balances, D)[0]
            unrealizedPnl = convert(notionalPosition, int256) - convert(openNotional, int256)
        elif position < 0:
            _pos: uint256 = convert(-position, uint256)
            if _pos > balances[N_COINS-1]: # vamm doesn't have enough to sell _pos quantity of base asset
                # @atul to think more deeply about this
                notionalPosition = 0
            else:
                notionalPosition = Views(self.views).get_dx(0, 1, _pos, balances, D)[0]
                unrealizedPnl =  convert(openNotional, int256) - convert(notionalPosition, int256)
    return notionalPosition, unrealizedPnl

@external
@view
def get_maker_position(amount: uint256, vUSD: uint256, vAsset: uint256, makerDToken: uint256) -> (int256, uint256, int256):
    makerPosSize: int256 = 0
    makerOpenNotional: uint256 = 0
    notionalPosition: uint256 = 0
    feeAdjustedPnl: int256 = 0
    unrealizedPnl: int256 = 0
    D: uint256 = 0
    balances: uint256[N_COINS] = empty(uint256[N_COINS])

    makerPosSize, makerOpenNotional, feeAdjustedPnl, D, balances = self._get_maker_position(amount, vUSD, vAsset, makerDToken)
    # calculate pnl after removing maker liquidity
    (notionalPosition, unrealizedPnl) = self._get_taker_notional_and_pnl(makerPosSize, makerOpenNotional, balances, D)
    unrealizedPnl += feeAdjustedPnl

    return makerPosSize, makerOpenNotional, unrealizedPnl

@external
@view
def get_notional(
        makerDToken: uint256,
        vUSD: uint256,
        vAsset: uint256,
        takerPosSize: int256,
        takerOpenNotional: uint256
    ) -> (uint256, int256, int256, uint256):
    assert msg.sender == self.amm, 'VAMM: OnlyAMM'
    makerPosSize: int256 = 0
    makerOpenNotional: uint256 = 0
    D: uint256 = 0
    balances: uint256[N_COINS] = empty(uint256[N_COINS])
    feeAdjustedPnl: int256 = 0

    # rug the maker liquidity, if any
    makerPosSize, makerOpenNotional, feeAdjustedPnl, D, balances = self._get_maker_position(makerDToken, vUSD, vAsset, makerDToken)

    position: int256 = takerPosSize
    openNotional: uint256 = takerOpenNotional
    notionalPosition: uint256 = 0
    unrealizedPnl: int256 = 0

    (notionalPosition, unrealizedPnl) = self._get_taker_notional_and_pnl(takerPosSize, takerOpenNotional, balances, D)

    if makerDToken > 0:
        makerDebt: uint256 = 2 * vUSD
        # notionalPos = Max(debt, maker impermanent notional pos [1]) + taker notional pos [2]
        # [1] and [2] are being calculated after removing the maker liquidity, reflected via (D, balances) returned from _get_maker_position
        notionalPosUpperBound: uint256 = notionalPosition + makerDebt

        position += makerPosSize
        openNotional = self._get_combined_open_notional(takerPosSize, takerOpenNotional, makerPosSize, makerOpenNotional)
        (notionalPosition, unrealizedPnl) = self._get_taker_notional_and_pnl(position, openNotional, balances, D)

        notionalPosition = max(notionalPosition, notionalPosUpperBound)
        unrealizedPnl += feeAdjustedPnl
    return notionalPosition, position, unrealizedPnl, openNotional

@view
@external
def calc_token_amount(amounts: uint256[N_COINS], deposit: bool) -> uint256:
    return Views(self.views).calc_token_amount(amounts, deposit)


# # Admin parameters
@external
def setAMM(_address: address):
    assert msg.sender == self.owner, 'VAMM: OnlyOwner'
    self.amm = _address


# @external
# def ramp_A_gamma(future_A: uint256, future_gamma: uint256, future_time: uint256):
#     assert msg.sender == self.owner  # dev: only owner
#     assert block.timestamp > self.initial_A_gamma_time + (MIN_RAMP_TIME-1)
#     assert future_time > block.timestamp + (MIN_RAMP_TIME-1)  # dev: insufficient time

#     A_gamma: uint256[2] = self._A_gamma()
#     initial_A_gamma: uint256 = shift(A_gamma[0], 128)
#     initial_A_gamma = bitwise_or(initial_A_gamma, A_gamma[1])

#     assert future_A > 0
#     assert future_A < MAX_A+1
#     assert future_gamma > MIN_GAMMA-1
#     assert future_gamma < MAX_GAMMA+1

#     ratio: uint256 = 10**18 * future_A / A_gamma[0]
#     assert ratio < 10**18 * MAX_A_CHANGE + 1
#     assert ratio > 10**18 / MAX_A_CHANGE - 1

#     ratio = 10**18 * future_gamma / A_gamma[1]
#     assert ratio < 10**18 * MAX_A_CHANGE + 1
#     assert ratio > 10**18 / MAX_A_CHANGE - 1

#     self.initial_A_gamma = initial_A_gamma
#     self.initial_A_gamma_time = block.timestamp

#     future_A_gamma: uint256 = shift(future_A, 128)
#     future_A_gamma = bitwise_or(future_A_gamma, future_gamma)
#     self.future_A_gamma_time = future_time
#     self.future_A_gamma = future_A_gamma

#     log RampAgamma(A_gamma[0], future_A, A_gamma[1], future_gamma, block.timestamp, future_time)


# @external
# def stop_ramp_A_gamma():
#     assert msg.sender == self.owner  # dev: only owner

#     A_gamma: uint256[2] = self._A_gamma()
#     current_A_gamma: uint256 = shift(A_gamma[0], 128)
#     current_A_gamma = bitwise_or(current_A_gamma, A_gamma[1])
#     self.initial_A_gamma = current_A_gamma
#     self.future_A_gamma = current_A_gamma
#     self.initial_A_gamma_time = block.timestamp
#     self.future_A_gamma_time = block.timestamp
#     # now (block.timestamp < t1) is always False, so we return saved A

#     log StopRampA(A_gamma[0], A_gamma[1], block.timestamp)


# @external
# def commit_new_parameters(
#     _new_mid_fee: uint256,
#     _new_out_fee: uint256,
#     _new_admin_fee: uint256,
#     _new_fee_gamma: uint256,
#     _new_allowed_extra_profit: uint256,
#     _new_adjustment_step: uint256,
#     _new_ma_half_time: uint256,
#     ):
#     assert msg.sender == self.owner  # dev: only owner
#     assert self.admin_actions_deadline == 0  # dev: active action

#     new_mid_fee: uint256 = _new_mid_fee
#     new_out_fee: uint256 = _new_out_fee
#     new_admin_fee: uint256 = _new_admin_fee
#     new_fee_gamma: uint256 = _new_fee_gamma
#     new_allowed_extra_profit: uint256 = _new_allowed_extra_profit
#     new_adjustment_step: uint256 = _new_adjustment_step
#     new_ma_half_time: uint256 = _new_ma_half_time

#     # Fees
#     if new_out_fee < MAX_FEE+1:
#         assert new_out_fee > MIN_FEE-1  # dev: fee is out of range
#     else:
#         new_out_fee = self.out_fee
#     if new_mid_fee > MAX_FEE:
#         new_mid_fee = self.mid_fee
#     assert new_mid_fee <= new_out_fee  # dev: mid-fee is too high
#     if new_admin_fee > MAX_ADMIN_FEE:
#         new_admin_fee = self.admin_fee

#     # AMM parameters
#     if new_fee_gamma < 10**18:
#         assert new_fee_gamma > 0  # dev: fee_gamma out of range [1 .. 10**18]
#     else:
#         new_fee_gamma = self.fee_gamma
#     if new_allowed_extra_profit > 10**18:
#         new_allowed_extra_profit = self.allowed_extra_profit
#     if new_adjustment_step > 10**18:
#         new_adjustment_step = self.adjustment_step

#     # MA
#     if new_ma_half_time < 7*86400:
#         assert new_ma_half_time > 0  # dev: MA time should be longer than 1 second
#     else:
#         new_ma_half_time = self.ma_half_time

#     _deadline: uint256 = block.timestamp + ADMIN_ACTIONS_DELAY
#     self.admin_actions_deadline = _deadline

#     self.future_admin_fee = new_admin_fee
#     self.future_mid_fee = new_mid_fee
#     self.future_out_fee = new_out_fee
#     self.future_fee_gamma = new_fee_gamma
#     self.future_allowed_extra_profit = new_allowed_extra_profit
#     self.future_adjustment_step = new_adjustment_step
#     self.future_ma_half_time = new_ma_half_time

#     log CommitNewParameters(_deadline, new_admin_fee, new_mid_fee, new_out_fee,
#                             new_fee_gamma,
#                             new_allowed_extra_profit, new_adjustment_step,
#                             new_ma_half_time)


# @external
# @nonreentrant('lock')
# def apply_new_parameters():
#     assert msg.sender == self.owner  # dev: only owner
#     assert block.timestamp >= self.admin_actions_deadline  # dev: insufficient time
#     assert self.admin_actions_deadline != 0  # dev: no active action

#     self.admin_actions_deadline = 0

#     admin_fee: uint256 = self.future_admin_fee
#     if self.admin_fee != admin_fee:
#         self._claim_admin_fees()
#         self.admin_fee = admin_fee

#     mid_fee: uint256 = self.future_mid_fee
#     self.mid_fee = mid_fee
#     out_fee: uint256 = self.future_out_fee
#     self.out_fee = out_fee
#     fee_gamma: uint256 = self.future_fee_gamma
#     self.fee_gamma = fee_gamma
#     allowed_extra_profit: uint256 = self.future_allowed_extra_profit
#     self.allowed_extra_profit = allowed_extra_profit
#     adjustment_step: uint256 = self.future_adjustment_step
#     self.adjustment_step = adjustment_step
#     ma_half_time: uint256 = self.future_ma_half_time
#     self.ma_half_time = ma_half_time

#     log NewParameters(admin_fee, mid_fee, out_fee,
#                       fee_gamma,
#                       allowed_extra_profit, adjustment_step,
#                       ma_half_time)


# @external
# def revert_new_parameters():
#     assert msg.sender == self.owner  # dev: only owner

#     self.admin_actions_deadline = 0


# @external
# def commit_transfer_ownership(_owner: address):
#     assert msg.sender == self.owner  # dev: only owner
#     assert self.transfer_ownership_deadline == 0  # dev: active transfer

#     _deadline: uint256 = block.timestamp + ADMIN_ACTIONS_DELAY
#     self.transfer_ownership_deadline = _deadline
#     self.future_owner = _owner

#     log CommitNewAdmin(_deadline, _owner)


# @external
# def apply_transfer_ownership():
#     assert msg.sender == self.owner  # dev: only owner
#     assert block.timestamp >= self.transfer_ownership_deadline  # dev: insufficient time
#     assert self.transfer_ownership_deadline != 0  # dev: no active transfer

#     self.transfer_ownership_deadline = 0
#     _owner: address = self.future_owner
#     self.owner = _owner

#     log NewAdmin(_owner)


# @external
# def revert_transfer_ownership():
#     assert msg.sender == self.owner  # dev: only owner

#     self.transfer_ownership_deadline = 0


# @external
# def kill_me():
#     assert msg.sender == self.owner  # dev: only owner
#     assert self.kill_deadline > block.timestamp  # dev: deadline has passed
#     self.is_killed = True


# @external
# def unkill_me():
#     assert msg.sender == self.owner  # dev: only owner
#     self.is_killed = False
