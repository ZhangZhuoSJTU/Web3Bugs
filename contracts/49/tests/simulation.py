import typing as tp


class Position:
    """
    Python model of Overlay position.
    """
    lv: int  # base leverage of this position
    long: bool  # side of this position
    n: int  # position shares of collateral pool
    oi: int  # position shares of open interest pool
    d: int  # total debt associated with this position
    p0: int  # lock price of this position
    us: tp.Dict[int, int]  # user shares of this position


class Market:
    """
    Python model of Overlay V1 market accounting for pooled funds.

    Required invariants:
        nl + ns = const

    FP evolution:
        oil(t) = oil(t-1) - fp(t-1)
        ois(t) = ois(t-1) + fp(t-1)
        fp(t) = k * ( oil(t) - ois(t) )
    """
    nl: int  # total collateral locked long
    oil: int  # total open interest long
    ns: int  # total collateral locked short
    ois: int  # total open interest short
    k: int  # funding payment constant
    # discrete allowed leverages on market
    als: tp.List[int] = [1, 2, 3, 4, 5]
    fee: float = 15 * 10 ** 14  # 15 bps
    ps: tp.List[Position] = []  # list of all positions indexed by pid
