type ActorMarketBalances = {
  long: number
  short: number
  lp: number
}

type MarketTokenPrices = {
  long: number
  short: number
  lp: number
}

type MarketToken = 'long' | 'short'

type DataPoint = {
  time: number
  longPrice: number
  shortPrice: number
  leftoverLpPercentProfit: number
  allInLpPercentProfit: number
  maxLongTradeValueWithoutSignificantSlippage: number
  maxShortTradeValueWithoutSignificantSlippage: number
  longPoolValue: number
  shortPoolValue: number
}

type PoolBounds = {
  ceil: number
  floor: number
}

type PoolConfig = {
  fee: number
  bounds: PoolBounds
}

type PoolBalance = {
  stable: number
  market: number
}

type MarketConfig = {
  bounds: PoolBounds
  fee: number
  protocolFee: number
}

export type {
  ActorMarketBalances,
  MarketTokenPrices,
  MarketToken,
  DataPoint,
  PoolBounds,
  PoolConfig,
  PoolBalance,
  MarketConfig,
}
