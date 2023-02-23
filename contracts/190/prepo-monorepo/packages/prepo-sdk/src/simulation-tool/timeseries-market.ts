import { Actor } from '.'
import Market from './market'
import Pool from './pool'
import { DataPoint, MarketConfig } from '../types'
import { MIN_IN_MS } from '../constants'

// Can add more state we want to record to this datapoint
interface TimeSeriesMarketConfig {
  interval?: number
  significantSlippage?: number
}

class TimeSeriesMarket extends Market {
  private timeSeries: DataPoint[]
  private curUnixTime: number
  private interval: number
  private significantSlippage: number
  constructor(
    name: string,
    config: MarketConfig,
    creatorStableDeposit: number,
    creator: Actor,
    timeSeriesMarketConfig: TimeSeriesMarketConfig = {}
  ) {
    super(name, config, creatorStableDeposit, creator)
    this.interval = timeSeriesMarketConfig.interval || MIN_IN_MS
    this.significantSlippage = timeSeriesMarketConfig.significantSlippage || 0.02
    this.curUnixTime = new Date('2021').getTime()
    this.timeSeries = []
  }
  // This is kinda jank, clean up later once we know DataPoint API
  // better
  checkpoint(leftoverLp: Actor, allInLp: Actor): void {
    const longPrice = Pool.calcMarketTokenPrice(this.longPool)
    const shortPrice = Pool.calcMarketTokenPrice(this.shortPool)
    const leftoverLpPercentProfit = this.getActorNetProfit(leftoverLp).percent
    const allInLpPercentProfit = this.getActorNetProfit(allInLp).percent
    const newDataPoint: DataPoint = {
      time: this.curUnixTime,
      longPrice,
      shortPrice,
      maxLongTradeValueWithoutSignificantSlippage:
        Math.abs(
          Pool.calcMarketTradeSizeToTargetPrice(
            this.longPool.virtualLiquidity,
            this.longPool.sqrtPrice,
            longPrice * (1 + this.significantSlippage)
          )
        ) * longPrice,
      maxShortTradeValueWithoutSignificantSlippage:
        Math.abs(
          Pool.calcMarketTradeSizeToTargetPrice(
            this.shortPool.virtualLiquidity,
            this.shortPool.sqrtPrice,
            shortPrice * (1 + this.significantSlippage)
          )
        ) * shortPrice,
      leftoverLpPercentProfit,
      allInLpPercentProfit,
      longPoolValue: Pool.calcPoolValue(
        this.longPool.realReserves,
        Pool.calcMarketTokenPrice(this.longPool)
      ),
      shortPoolValue: Pool.calcPoolValue(
        this.shortPool.realReserves,
        Pool.calcMarketTokenPrice(this.shortPool)
      ),
    }
    this.timeSeries.push(newDataPoint)
    this.curUnixTime += this.interval
  }
  getTimeSeries(): DataPoint[] {
    return this.timeSeries
  }
}

export default TimeSeriesMarket
