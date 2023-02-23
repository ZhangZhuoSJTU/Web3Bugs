import { getUnixTime } from 'date-fns'
import { BigNumber } from 'ethers'
import { formatEther } from 'ethers/lib/utils'
import { action, makeObservable, observable, reaction, runInAction } from 'mobx'
import { IconName } from 'prepo-ui'
import { ContractReturn, ContractStore, Factory } from 'prepo-stores'
import { SEC_IN_MS } from 'prepo-constants'
import { UniswapPoolEntity } from './UniswapPoolEntity'
import { Erc20Store } from './Erc20.entity'
import { RootStore } from '../RootStore'
import {
  ChartTimeframe,
  FormatPoolsHistoricalDatasOptions,
  HistoricalDataQueryType,
  Market,
  MarketHistoryData,
  MarketType,
  NormalizedPoolsData,
  NumberData,
  PoolsDayDatas,
  PoolsHourDatas,
  Range,
  SupportedMarketID,
  SliderSettings,
  ExitProfitLoss,
} from '../../types/market.types'
import { Direction } from '../../features/trade/TradeStore'
import { supportedMarketPools, SupportedMarketPools } from '../../lib/markets-pool-contracts'
import { SupportedMarketTokens } from '../../lib/markets-tokens-contracts'
import { SupportedContracts } from '../../lib/contract.types'
import { PrepoMarketAbi, PrepoMarketAbi__factory } from '../../../generated/typechain'
import { getContractCall } from '../utils/web3-store-utils'
import {
  calculateValuation,
  formatMarketHistoricalData,
  getTokenPrice,
  getTotalValueLockedUSD,
  getTradingVolume,
  normalizePoolsData,
  normalizePoolsDayDatas,
  normalizePoolsHourDatas,
  syncLatestData,
} from '../../utils/market-utils'
import {
  getDateRangeFromDays,
  getDateRangeFromHours,
  getDaysFromDateRange,
  getEndOfHour,
  getHoursFromDateRange,
  getStartOfHour,
  getUTCEndOfDay,
  getUTCStartOfDay,
} from '../../utils/date-utils'
import { DateRange } from '../../types/general.types'
import { PROJECT_START_TIMESTAMP, VALUATION_DENOMINATOR } from '../../lib/constants'
import { UNISWAP_MAX_DATAPOINTS } from '../graphs/UniswapV3GraphStore'

type GetCeilingLongPrice = PrepoMarketAbi['functions']['getCeilingLongPrice']
type GetCeilingValuation = PrepoMarketAbi['functions']['getCeilingValuation']
type GetExpiryTime = PrepoMarketAbi['functions']['getExpiryTime']
type GetFloorLongPrice = PrepoMarketAbi['functions']['getFloorLongPrice']
type GetFloorValuation = PrepoMarketAbi['functions']['getFloorValuation']

const getProjectStartedHours = (): number => {
  const now = new Date().getTime()
  const projectStartTimeInMs = PROJECT_START_TIMESTAMP * SEC_IN_MS
  return getHoursFromDateRange({ endTimeInMs: now, startTimeInMs: projectStartTimeInMs })
}

const timeframeMap = {
  [ChartTimeframe.DAY]: 24,
  [ChartTimeframe.WEEK]: 168,
  [ChartTimeframe.MONTH]: 720,
  [ChartTimeframe.YEAR]: 8760,
  [ChartTimeframe.MAX]: UNISWAP_MAX_DATAPOINTS * 24,
}
export class MarketEntity
  extends ContractStore<RootStore, SupportedContracts>
  implements Omit<Market, 'static' | 'address'>
{
  root: RootStore
  type: MarketType
  cachedTimeframe: ChartTimeframe
  cachedHistoricalData?: MarketHistoryData[]
  iconName: IconName
  name: string
  urlId: SupportedMarketID
  companyName: string
  long: {
    tokenAddress: SupportedMarketTokens
    poolAddress: SupportedMarketPools
  }
  longPool: UniswapPoolEntity | undefined
  short: {
    tokenAddress: SupportedMarketTokens
    poolAddress: SupportedMarketPools
  }
  longToken: Erc20Store | undefined
  shortPool: UniswapPoolEntity | undefined
  shortToken: Erc20Store | undefined
  selectedPool: UniswapPoolEntity | undefined
  selectedTimeframe: ChartTimeframe

  constructor(root: RootStore, data: Market) {
    super(root, data.address, PrepoMarketAbi__factory as unknown as Factory)
    this.root = root
    this.cachedTimeframe = ChartTimeframe.DAY
    this.iconName = data.iconName
    this.name = data.name
    this.urlId = data.urlId
    this.companyName = data.companyName
    this.long = data.long
    this.short = data.short
    this.type = data.type
    this.selectedTimeframe = ChartTimeframe.DAY

    makeObservable(this, {
      cachedHistoricalData: observable,
      selectedTimeframe: observable,
      setSelectedTimeframe: action.bound,
      getLongTokenPayout: action.bound,
      getShortTokenPayout: action.bound,
      getProfitLossOnExit: action.bound,
    })
    this.cacheHistoricalData()
  }

  init = (): void => {
    try {
      this.fetchPools()
    } catch (e) {
      this.root.toastStore.errorToast(`Error fetching pools for market ${this.name}`, e)
    }
  }

  cacheHistoricalData(): void {
    reaction(
      () => ({ historicalData: this.historicalData, selectedTimeframe: this.selectedTimeframe }),
      ({ historicalData, selectedTimeframe }) => {
        runInAction(() => {
          // allow showing loading UI if timeframe is changed
          // will be undefined if data hasn't been cached for that timeframe
          if (selectedTimeframe !== this.cachedTimeframe) this.cachedHistoricalData = historicalData

          // never allow showing loading UI if timeframe hasn't been changed,
          // this will happen when an hour/day is passed and GraphStore cache no longer works with the previous hour/day timestamp keys
          if (selectedTimeframe === this.cachedTimeframe && historicalData !== undefined)
            this.cachedHistoricalData = historicalData

          this.cachedTimeframe = this.selectedTimeframe
        })
      }
    )
  }

  fetchPools(): void {
    runInAction(() => {
      this.longToken = new Erc20Store({
        root: this.root,
        symbolOverride: `${this.name} Long`,
        tokenName: this.long.tokenAddress,
      })
      this.shortToken = new Erc20Store({
        root: this.root,
        symbolOverride: `${this.name} Short`,
        tokenName: this.short.tokenAddress,
      })
      this.longPool = new UniswapPoolEntity(this.root, this.long.poolAddress)
      this.shortPool = new UniswapPoolEntity(this.root, this.short.poolAddress)
      this.setSelectedPool('long')
    })
  }

  getDataByPeriod(
    { endTimeInMs, startTimeInMs }: DateRange,
    intervals: number,
    type: HistoricalDataQueryType
  ): MarketHistoryData[] | undefined {
    if (!this.longPoolAddress || !this.shortPoolAddress || !this.formatPoolsOptions)
      return undefined
    const queryCall =
      type === HistoricalDataQueryType.DAY ? 'historicalDailyData' : 'historicalHourlyData'
    const data = this.root.uniswapV3GraphStore[queryCall](
      this.longPoolAddress,
      this.shortPoolAddress,
      endTimeInMs,
      intervals
    )

    if (!data) return undefined
    const normalize =
      type === HistoricalDataQueryType.DAY ? normalizePoolsDayDatas : normalizePoolsHourDatas

    return formatMarketHistoricalData(normalize(data as PoolsDayDatas & PoolsHourDatas), {
      ...this.formatPoolsOptions,
      startTimeInMs,
      endTimeInMs,
      type,
    })
  }

  getHistoricalData({ endTimeInMs, startTimeInMs }: Partial<DateRange> = {}): {
    data: MarketHistoryData[] | undefined
    type: HistoricalDataQueryType
  } {
    const projectStartTimeInMs = PROJECT_START_TIMESTAMP * SEC_IN_MS

    const end = getEndOfHour(endTimeInMs ?? new Date().getTime()) + 1
    const start = getStartOfHour(startTimeInMs ?? projectStartTimeInMs)

    let selectedIntervals = getHoursFromDateRange({ endTimeInMs: end, startTimeInMs: start })
    let selectedStartTime = start
    let selectedEndTime = end
    let type = HistoricalDataQueryType.HOUR

    // handles if selected hours is more than uniswap subgraph can handle
    if (selectedIntervals > UNISWAP_MAX_DATAPOINTS) {
      const endDay = getUTCEndOfDay(end) + 1
      let startDay = getUTCStartOfDay(start)

      selectedIntervals = getDaysFromDateRange({
        endTimeInMs: endDay,
        startTimeInMs: startDay,
      })

      if (selectedIntervals > UNISWAP_MAX_DATAPOINTS) {
        selectedIntervals = UNISWAP_MAX_DATAPOINTS
        startDay = getDateRangeFromDays(selectedIntervals, endDay).startTimeInMs
      }

      selectedStartTime = startDay
      selectedEndTime = endDay
      type = HistoricalDataQueryType.DAY
    }

    return {
      data: this.getDataByPeriod(
        { endTimeInMs: selectedEndTime, startTimeInMs: selectedStartTime },
        selectedIntervals,
        type
      ),
      type,
    }
  }

  getLatestPoolsData(type: HistoricalDataQueryType): MarketHistoryData[] | undefined {
    if (!this.longPoolAddress || !this.shortPoolAddress || !this.formatPoolsOptions)
      return undefined
    const queryCall = type === HistoricalDataQueryType.DAY ? 'poolsDayDatas' : 'poolsHourDatas'
    const data = this.root.uniswapV3GraphStore[queryCall](
      this.longPoolAddress,
      this.shortPoolAddress
    )
    if (!data) return undefined
    const normalize =
      type === HistoricalDataQueryType.DAY ? normalizePoolsDayDatas : normalizePoolsHourDatas
    return formatMarketHistoricalData(normalize(data as PoolsDayDatas & PoolsHourDatas), {
      ...this.formatPoolsOptions,
      type,
    })
  }

  setSelectedPool(direction: Direction): void {
    this.selectedPool = this[`${direction}Pool`]
  }

  setSelectedTimeframe(timeframe: ChartTimeframe): void {
    this.selectedTimeframe = timeframe
  }

  // contract calls

  getCeilingLongPrice(
    ...params: Parameters<GetCeilingLongPrice>
  ): ContractReturn<GetCeilingLongPrice> {
    return this.call<GetCeilingLongPrice>('getCeilingLongPrice', params, { subscribe: false })
  }

  getCeilingValuation(
    ...params: Parameters<GetCeilingValuation>
  ): ContractReturn<GetCeilingValuation> {
    return this.call<GetCeilingValuation>('getCeilingValuation', params, { subscribe: false })
  }

  getExpiryTime(...params: Parameters<GetExpiryTime>): ContractReturn<GetExpiryTime> {
    return this.call<GetExpiryTime>('getExpiryTime', params, { subscribe: false })
  }

  getFloorLongPrice(...params: Parameters<GetFloorLongPrice>): ContractReturn<GetFloorLongPrice> {
    return this.call<GetFloorLongPrice>('getFloorLongPrice', params, { subscribe: false })
  }

  getFloorValuation(...params: Parameters<GetFloorValuation>): ContractReturn<GetFloorValuation> {
    return this.call<GetFloorValuation>('getFloorValuation', params, { subscribe: false })
  }

  // getters

  get ceilingLongPrice(): BigNumber | undefined {
    return getContractCall(this.getCeilingLongPrice())
  }

  get ceilingValuation(): number | undefined {
    return getContractCall(this.getCeilingValuation())?.toNumber()
  }

  /**
   * Get the connection state.
   *
   * @returns {Object} estimatedValuation The estimatedValuation object
   * @returns {number} estimatedValuation.value The complete accurate estimated valuation
   * @returns {number} estimatedValuation.denominated The estimated valuation as denominated value (short value used for operations)
   */
  get estimatedValuation(): NumberData | undefined {
    const { longTokenPrice, payoutRange, valuationRange } = this
    if (longTokenPrice === undefined || !valuationRange || !payoutRange) return undefined
    const valuation = calculateValuation({ longTokenPrice, payoutRange, valuationRange })
    return { value: valuation, denominated: valuation / VALUATION_DENOMINATOR }
  }

  get expiryTime(): number | undefined {
    const expiryTimestampInSeconds = getContractCall(this.getExpiryTime())
    if (expiryTimestampInSeconds === undefined) return undefined
    return expiryTimestampInSeconds.toNumber() * SEC_IN_MS
  }

  get floorLongPrice(): BigNumber | undefined {
    return getContractCall(this.getFloorLongPrice())
  }

  get floorValuation(): number | undefined {
    return getContractCall(this.getFloorValuation())?.toNumber()
  }

  get formatPoolsOptions():
    | Omit<FormatPoolsHistoricalDatasOptions, 'endTimeInMs' | 'startTimeInMs' | 'type'>
    | undefined {
    const { longToken, payoutRange, shortToken, valuationRange } = this
    if (
      longToken?.address !== undefined &&
      shortToken?.address !== undefined &&
      payoutRange &&
      valuationRange
    ) {
      const tokenAddresses = { long: longToken.address, short: shortToken.address }
      return { tokenAddresses, payoutRange, valuationRange }
    }
    return undefined
  }

  get historicalDataDateRange(): DateRange {
    return getDateRangeFromHours(
      Math.min(getProjectStartedHours(), timeframeMap[this.selectedTimeframe])
    )
  }

  get historicalData(): MarketHistoryData[] | undefined {
    const { data, type } = this.getHistoricalData(this.historicalDataDateRange)
    if (data === undefined) return undefined
    return syncLatestData(data, type, this.getLatestPoolsData(type))
  }

  get liquidity(): NumberData | undefined {
    if (
      this.poolsData === undefined ||
      this.root.preCTTokenStore.address === undefined ||
      this.payoutRange === undefined
    )
      return undefined
    const { longTokenPool, shortTokenPool } = this.poolsData
    const longLiquidity = getTotalValueLockedUSD(
      longTokenPool,
      this.payoutRange,
      this.root.preCTTokenStore.address
    )
    const shortLiquidity = getTotalValueLockedUSD(
      shortTokenPool,
      this.payoutRange,
      this.root.preCTTokenStore.address
    )
    const value = longLiquidity + shortLiquidity
    return { value }
  }

  get longPoolAddress(): string | undefined {
    const { name } = this.root.web3Store.network
    return supportedMarketPools[this.long.poolAddress]?.[name]?.toLocaleLowerCase()
  }

  get longTokenBalance(): string | undefined {
    return this.longToken?.tokenBalanceFormat
  }

  get longTokenBalanceBN(): BigNumber | undefined {
    return this.longToken?.tokenBalanceRaw
  }

  get longTokenPrice(): number | undefined {
    if (this.longPool?.poolPriceData === undefined || this.longToken?.address === undefined)
      return undefined
    return getTokenPrice(this.longToken.address, this.longPool.poolPriceData)
  }

  get payoutRange(): Range | undefined {
    if (this.ceilingLongPrice === undefined || this.floorLongPrice === undefined) return undefined
    return [+formatEther(this.floorLongPrice), +formatEther(this.ceilingLongPrice)]
  }

  get poolsData(): NormalizedPoolsData | undefined {
    if (!this.longPoolAddress || !this.shortPoolAddress) return undefined
    return normalizePoolsData(
      this.root.uniswapV3GraphStore.poolsQuery(this.longPoolAddress, this.shortPoolAddress)
    )
  }

  get realTimeChartData(): MarketHistoryData[] | undefined {
    if (this.cachedHistoricalData === undefined || this.estimatedValuation === undefined)
      return undefined
    const currentData: MarketHistoryData = {
      timestamp: getUnixTime(new Date()),
      liquidity: 0,
      valuation: this.estimatedValuation.value,
      volume: 0,
    }
    return [...this.cachedHistoricalData, currentData]
  }

  get shortPoolAddress(): string | undefined {
    const { name } = this.root.web3Store.network
    return supportedMarketPools[this.short.poolAddress]?.[name]?.toLocaleLowerCase()
  }

  get shortTokenBalance(): string | undefined {
    return this.shortToken?.tokenBalanceFormat
  }

  get shortTokenBalanceBN(): BigNumber | undefined {
    return this.shortToken?.tokenBalanceRaw
  }

  get shortTokenPrice(): number | undefined {
    if (this.shortPool?.poolPriceData === undefined || this.shortToken?.address === undefined)
      return undefined
    return getTokenPrice(this.shortToken.address, this.shortPool.poolPriceData)
  }

  get tradingVolume(): NumberData | undefined {
    if (this.poolsData === undefined || !this.longToken?.address || !this.shortToken?.address)
      return undefined
    const { longTokenPool, shortTokenPool } = this.poolsData
    const longVolume = getTradingVolume(longTokenPool, this.longToken.address)
    const shortVolume = getTradingVolume(shortTokenPool, this.shortToken.address)
    return { value: longVolume + shortVolume }
  }

  get valuationRange(): Range | undefined {
    if (this.ceilingValuation === undefined || this.floorValuation === undefined) return undefined
    return [
      this.floorValuation * VALUATION_DENOMINATOR,
      this.ceilingValuation * VALUATION_DENOMINATOR,
    ]
  }

  get sliderSettings(): SliderSettings | undefined {
    if (
      this.floorValuation === undefined ||
      this.ceilingValuation === undefined ||
      this.estimatedValuation?.denominated === undefined
    )
      return undefined

    return {
      min: this.floorValuation,
      max: this.ceilingValuation,
      currentValuation: this.estimatedValuation?.denominated,
    }
  }

  getProfitLossOnExit(
    direction: Direction,
    exitValuation: number,
    initialInvestment: number
  ): ExitProfitLoss | undefined {
    if (
      this.floorValuation === undefined ||
      this.ceilingValuation === undefined ||
      this.estimatedValuation?.denominated === undefined
    )
      return undefined

    const tokenPayout = direction === 'long' ? this.getLongTokenPayout : this.getShortTokenPayout
    const currentValuation = this.estimatedValuation?.denominated
    const currentValuationPayout = tokenPayout(currentValuation)
    const exitValuationPayout = tokenPayout(exitValuation)
    if (!currentValuationPayout || !exitValuationPayout) return undefined

    const differencePayouts = exitValuationPayout - currentValuationPayout
    const expectedProfitLossPercentage = differencePayouts / currentValuationPayout
    const expectedProfitLoss = initialInvestment * expectedProfitLossPercentage
    const finalInvestmentValue = initialInvestment + expectedProfitLoss

    return {
      currentValuationPayout,
      exitValuationPayout,
      expectedProfitLossPercentage,
      expectedProfitLoss,
      finalInvestmentValue,
    }
  }

  getLongTokenPayout(expectedValuation: number): number | undefined {
    const { floorValuation, ceilingValuation } = this
    if (!floorValuation || !ceilingValuation || !this.payoutRange || !this.longTokenPrice)
      return undefined

    const payoutFloor = this.payoutRange[0]
    const payoutCeil = this.payoutRange[1]

    const top = expectedValuation - floorValuation
    const bottom = ceilingValuation - floorValuation
    const center = top / bottom
    const payout = payoutCeil - payoutFloor
    const longTokenPayout = payoutFloor + center * payout

    return longTokenPayout
  }

  getShortTokenPayout(expectedValuation: number): number | undefined {
    const longTokenPayout = this.getLongTokenPayout(expectedValuation)
    if (!longTokenPayout) return undefined
    return 1 - longTokenPayout
  }
}
