import Actor from './actor'
import TimeSeriesMarket from './timeseries-market'
import Pool from './pool'
import { DataPoint } from '../types'

function generateMarketData({
  lpDeposit,
  significantSlippage = 0.02,
  lowRes = false,
  range,
}: {
  lpDeposit: number
  significantSlippage?: number
  lowRes?: boolean
  range?: [low: number, high: number]
}): DataPoint[] {
  // Create Market with whale LP
  const lp = new Actor('LPInitial', lpDeposit)
  const lowerBoundBuffer = range ? range[0] : 0.01
  const upperBoundBuffer = range ? range[1] : 0.99
  const market = new TimeSeriesMarket(
    'Market',
    {
      bounds: { ceil: 0.8, floor: 0.2 },
      fee: 0.0,
      protocolFee: 0.0,
    },
    lpDeposit,
    lp,
    { significantSlippage }
  )
  const allInLp = new Actor('allInLp', 10)
  // TODO: reenable once fixed allInLp math
  // market.mint(allInLp, 10);
  // market.depositLiquidityNoLeftover(allInLp);
  const tradeSize = lowRes ? lpDeposit / 100 : lpDeposit / 1000
  // Collect data from full range of outcomes
  const trader = new Actor('trader', Number.MAX_SAFE_INTEGER)
  // TODO: update onlyBounds check to work with concentrated liq pools
  // if (onlyBounds) {
  //   market.openPosition(trader, market.getMaxLongTradeSize(), "long");
  //   market.checkpoint(lp, allInLp);
  //   market.openPosition(trader, market.getMaxShortTradeSize(), "short");
  //   market.checkpoint(lp, allInLp);
  //   return market.getTimeSeries();
  // }
  // trade long until we overshoot upper bound
  while (Pool.calcMarketTokenPrice(market.longPool) < upperBoundBuffer) {
    market.checkpoint(lp, allInLp)
    market.openPosition(trader, 'long', tradeSize)
  }
  // overshot upperbound, trade back under it then make
  // a percise trade so long price is perfectly at the upperbound
  // TODO: update so it actually perfectly hits upper bound accounting for arb
  market.openPosition(trader, 'short', tradeSize)
  market.openPosition(
    trader,
    'long',
    Pool.calcMarketTradeSizeToTargetPrice(
      market.longPool.virtualLiquidity,
      market.longPool.sqrtPrice,
      market.config.bounds.ceil
    )
  )
  market.checkpoint(lp, allInLp)
  // trade short until we overshoot lower bound
  while (Pool.calcMarketTokenPrice(market.longPool) > lowerBoundBuffer) {
    market.checkpoint(lp, allInLp)
    market.openPosition(trader, 'short', tradeSize)
  }
  // overshot lowerbound, trade back over it then make
  // a percise trade so long price is perfectly at the lowerbound
  market.openPosition(trader, 'long', tradeSize)
  market.openPosition(
    trader,
    'short',
    Pool.calcMarketTradeSizeToTargetPrice(
      market.shortPool.virtualLiquidity,
      market.shortPool.sqrtPrice,
      market.config.bounds.ceil
    )
  )
  market.checkpoint(lp, allInLp)
  return market.getTimeSeries()
}

export default generateMarketData
