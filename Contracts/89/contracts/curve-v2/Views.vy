# @version 0.2.12
# (c) Curve.Fi, 2021

# This contract contains view-only external methods which can be gas-inefficient
# when called from smart contracts but ok to use from frontend
# Called only from Curve contract as it uses msg.sender as the contract address
from vyper.interfaces import ERC20

interface Curve:
    def A() -> uint256: view
    def gamma() -> uint256: view
    def price_scale() -> uint256: view
    def balances(i: uint256) -> uint256: view
    def D() -> uint256: view
    def totalSupply() -> uint256: view
    def fee_calc(xp: uint256[N_COINS]) -> uint256: view
    def calc_token_fee(amounts: uint256[N_COINS], xp: uint256[N_COINS]) -> uint256: view
    def token() -> address: view

interface Math:
    def newton_D(ANN: uint256, gamma: uint256, x_unsorted: uint256[N_COINS]) -> uint256: view
    def newton_y(ANN: uint256, gamma: uint256, x: uint256[N_COINS], D: uint256, i: uint256) -> uint256: view

N_COINS: constant(int128) = 2  # <- change
PRECISION: constant(uint256) = 10 ** 18  # The precision to convert to
PRECISIONS: constant(uint256[N_COINS]) = [
    10**12,
    1,
]

math: address


@external
def __init__(math: address):
    self.math = math

@external
@view
def get_dy(i: uint256, j: uint256, dx: uint256, balances: uint256[N_COINS], D: uint256) -> (uint256, uint256):
    assert i != j  # dev: same input and output coin
    assert i < N_COINS  # dev: coin index out of range
    assert j < N_COINS  # dev: coin index out of range
    assert dx > 0, "do not exchange 0 coins"

    price_scale: uint256 = Curve(msg.sender).price_scale() * PRECISIONS[1]
    xp: uint256[N_COINS] = balances

    xp[i] += dx
    xp = [xp[0] * PRECISIONS[0], xp[1] * price_scale / PRECISION]

    A: uint256 = Curve(msg.sender).A()
    gamma: uint256 = Curve(msg.sender).gamma()

    y: uint256 = Math(self.math).newton_y(A, gamma, xp, D, j)
    dy: uint256 = xp[j] - y - 1
    xp[j] = y
    if j > 0:
        dy = dy * PRECISION / price_scale
    else:
        dy /= PRECISIONS[0]

    fee: uint256 = Curve(msg.sender).fee_calc(xp) * dy / 10**10
    dy -= fee
    return dy, fee

@external
@view
def get_dx(i: uint256, j: uint256, dy: uint256, balances: uint256[N_COINS], D: uint256) -> (uint256, uint256):
    assert i != j  # dev: same input and output coin
    assert i < N_COINS  # dev: coin index out of range
    assert j < N_COINS  # dev: coin index out of range
    assert dy > 0, "do not exchange 0 coins"

    price_scale: uint256 = Curve(msg.sender).price_scale() * PRECISIONS[1]
    xp: uint256[N_COINS] = balances

    xp[j] -= dy
    xp = [xp[0] * PRECISIONS[0], xp[1] * price_scale / PRECISION]

    A: uint256 = Curve(msg.sender).A()
    gamma: uint256 = Curve(msg.sender).gamma()

    x: uint256 = Math(self.math).newton_y(A, gamma, xp, D, i)
    dx: uint256 = x - xp[i] + 1
    xp[i] = x
    if i > 0:
        dx = dx * PRECISION / price_scale
    else:
        dx /= PRECISIONS[0]

    fee: uint256 = Curve(msg.sender).fee_calc(xp) * dx / 10**10
    dx += fee
    return dx, fee

@view
@external
def calc_token_amount(amounts: uint256[N_COINS], deposit: bool) -> uint256:
    token_supply: uint256 = Curve(msg.sender).totalSupply()
    price_scale: uint256 = Curve(msg.sender).price_scale() * PRECISIONS[1]

    xp: uint256[N_COINS] = [
        Curve(msg.sender).balances(0) * PRECISIONS[0],
        Curve(msg.sender).balances(1) * PRECISIONS[1] * price_scale / PRECISION]

    amountsp: uint256[N_COINS] = [
        amounts[0] * PRECISIONS[0],
        amounts[1] * price_scale / PRECISION]

    if deposit:
        for k in range(N_COINS):
            xp[k] += amountsp[k]
    else:
        for k in range(N_COINS):
            xp[k] -= amountsp[k]

    A: uint256 = Curve(msg.sender).A()
    gamma: uint256 = Curve(msg.sender).gamma()
    D: uint256 = Math(self.math).newton_D(A, gamma, xp)
    d_token: uint256 = token_supply * D / Curve(msg.sender).D()
    if deposit:
        d_token -= token_supply
    else:
        d_token = token_supply - d_token
    d_token -= Curve(msg.sender).calc_token_fee(amountsp, xp) * d_token / 10**10 + 1
    return d_token
