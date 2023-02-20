import math
import random

from tests.constants import BASIS_POINT, RATE_PRECISION, SECONDS_IN_YEAR
from tests.helpers import get_fcash_token


def get_portfolio(
    assetMarketIndexes,
    targetLocalAvailable,
    markets,
    blockTime,
    fCashHaircut=150 * BASIS_POINT,
    debtBuffer=150 * BASIS_POINT,
    currencyId=1,
):
    # split targetLocalAvailable into n assets w/ x PV
    scalars = [random.randint(-1000e8, 1000e8) for i in range(0, len(assetMarketIndexes))]
    scale = targetLocalAvailable / sum(scalars)
    pvArray = [math.trunc(s * scale) for s in scalars]

    portfolio = []
    for marketIndex, pv in zip(assetMarketIndexes, pvArray):
        rate = markets[marketIndex - 1][6]
        if pv < 0:
            rate = rate + debtBuffer
        else:
            rate = 0 if rate - fCashHaircut < 0 else rate - fCashHaircut
        timeToMaturity = markets[marketIndex - 1][1] - blockTime

        # notional of each asset = PV * e ^ rt
        notional = math.trunc(
            pv * math.exp((rate / RATE_PRECISION) * (timeToMaturity / SECONDS_IN_YEAR))
        )
        portfolio.append(get_fcash_token(marketIndex, currencyId=currencyId, notional=notional))

    return portfolio
