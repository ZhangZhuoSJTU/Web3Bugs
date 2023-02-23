import { SEC_IN_MS } from 'prepo-constants'
import getUnixTime from 'date-fns/getUnixTime'
import { getEndOfHour, getMilisecondsByHours, getUTCEndOfDay } from './date-utils'
import { getMultiplier } from './mafs-utils'
import {
  CalculateValuationParams,
  FormatPoolDayDataOptions,
  MarketHistoryDataMap,
  MarketHistoryData,
  PoolsDayDatas,
  FormatPoolsHistoricalDatasOptions,
  PoolsHourDatas,
  NormalizedMarketHistoricalData,
  PoolHourData,
  NormalizedPoolHistoricalData,
  PoolDayData,
  NormalizedToken,
  PoolsData,
  NormalizedPoolsData,
  PoolData,
  NormalizedPoolData,
  NormalizedTokenPairWithPriceOnly,
  HistoricalDataQueryType,
  Range,
} from '../types/market.types'

export const getTokenPrice = (
  tokenAddress: string,
  { token0, token1 }: NormalizedTokenPairWithPriceOnly
): number => {
  if (tokenAddress.toLowerCase() === token0.id.toLowerCase()) return token1.price
  if (tokenAddress.toLowerCase() === token1.id.toLowerCase()) return token0.price
  return 0
}

export const getTradingVolume = (
  {
    token0,
    token1,
  }: {
    token0: Omit<NormalizedToken, 'price'>
    token1: Omit<NormalizedToken, 'price'>
  },
  tokenAddress: string
): number => {
  // the opposite one is preCT volume, which can be used as USD volume
  if (token0.id.toLowerCase() === tokenAddress.toLowerCase()) return +(token1.volume ?? 0)
  if (token1.id.toLowerCase() === tokenAddress.toLowerCase()) return +(token0.volume ?? 0)
  return 0
}

export const getTotalValueLockedUSD = (
  { token0, token1 }: NormalizedPoolData,
  payRange: Range,
  baseTokenAddress: string
): number => {
  const multiplier = getMultiplier(payRange)
  let totalValueLocked = 0
  if (token0.id.toLowerCase() === baseTokenAddress.toLowerCase())
    totalValueLocked = token0.totalValueLocked
  if (token1.id.toLowerCase() === baseTokenAddress.toLowerCase())
    totalValueLocked = token1.totalValueLocked
  return totalValueLocked * 2 * multiplier
}

const getIntervalInUnix = (type: HistoricalDataQueryType): number =>
  Math.floor(getMilisecondsByHours(type === HistoricalDataQueryType.HOUR ? 1 : 24) / SEC_IN_MS)

export const calculateValuation = ({
  longTokenPrice,
  payoutRange,
  valuationRange,
}: CalculateValuationParams): number => {
  const floorPayout = payoutRange[0]
  const ceilingPayout = payoutRange[1]
  const floorValuation = valuationRange[0]
  const ceilingValuation = valuationRange[1]

  const tokenPayoutDiff = longTokenPrice - floorPayout
  const valuationDiff = ceilingValuation - floorValuation
  const payoutDiff = ceilingPayout - floorPayout
  return +(floorValuation + (tokenPayoutDiff / payoutDiff) * valuationDiff).toFixed(2)
}

// first, separate in-range data and out-range data
// if first in-range data is within startTimestamp's window
// we have everything we need to backfill data
// else, the first few datapoints are empty
// hence we try to find from the latest out-range data
// and use that to backfill data
// if none is found, market is not created before the first datapoint (in and out range data)
// hence backfill with undefined and show N/A on chart
const filterAndBackfillData = (
  poolData: NormalizedPoolHistoricalData[],
  options: FormatPoolsHistoricalDatasOptions & FormatPoolDayDataOptions
): MarketHistoryDataMap => {
  const inRangeData: MarketHistoryDataMap = {}
  const outRangeData: MarketHistoryDataMap = {}
  const { startTimeInMs, endTimeInMs, tokenType, tokenAddresses, type, ...otherOptions } = options
  const interval = getIntervalInUnix(type)

  const now = new Date().getTime()
  const defaultEndTime =
    (type === HistoricalDataQueryType?.DAY ? getUTCEndOfDay(now) : getEndOfHour(now)) + 1
  const defaultStartTime = defaultEndTime - interval * SEC_IN_MS
  const startTimestamp = getUnixTime(new Date(startTimeInMs ?? defaultStartTime))
  const endTimestamp = getUnixTime(new Date(endTimeInMs ?? defaultEndTime))

  const tokenAddress = tokenAddresses[tokenType]
  // separate data within and out of user selected range
  poolData.forEach(({ liquidity, token0, token1, timestamp }) => {
    const tokenPrice = getTokenPrice(tokenAddress, { token0, token1 })
    const longTokenPrice = tokenType === 'long' ? tokenPrice : 1 - tokenPrice
    const valuation = calculateValuation({ longTokenPrice, ...otherOptions })
    const volume = getTradingVolume({ token0, token1 }, tokenAddress)
    if (timestamp !== undefined) {
      if (timestamp >= startTimestamp && timestamp <= endTimestamp) {
        // in-range
        inRangeData[timestamp] = {
          timestamp,
          liquidity,
          valuation,
          volume,
        }
      } else if (timestamp < startTimestamp) {
        // out-range
        outRangeData[timestamp] = { timestamp, liquidity, valuation, volume }
      }
    }
  })

  const outRangeTimestamps = Object.keys(outRangeData)
  const latestOutRangeTimestamp = outRangeTimestamps[outRangeTimestamps.length - 1]
  const latestOutRangeData = {
    ...outRangeData[+latestOutRangeTimestamp],
    timestamp: startTimestamp - interval,
  }

  const inRangeTimestamps = Object.keys(inRangeData)
  const firstInRangeTimestamp = inRangeTimestamps[0]

  const firstInrangeDataValid =
    firstInRangeTimestamp !== undefined && +firstInRangeTimestamp <= startTimestamp + interval - 1
  // check if first in-range data is within startTimestamp's window
  // for example if start time is 8pm, 1st July, and firstInRangeTimestamp is 11pm, 1st July
  // this would be valid for daily data but not for hourly data
  const firstInRangeData = firstInrangeDataValid
    ? inRangeData[+firstInRangeTimestamp]
    : latestOutRangeData

  let curTimestamp = firstInRangeData.timestamp
  let latestValuation = firstInRangeData.valuation
  let latestLiquidity = firstInRangeData.liquidity

  // start backfilling data
  while (curTimestamp < endTimestamp - interval) {
    const nextTimestamp = curTimestamp + interval
    if (inRangeData[nextTimestamp]) {
      latestLiquidity = inRangeData[nextTimestamp].liquidity
      latestValuation = inRangeData[nextTimestamp].valuation
      // data cannot exceed current time
    } else if (nextTimestamp <= getUnixTime(new Date())) {
      inRangeData[nextTimestamp] = {
        liquidity: latestLiquidity,
        timestamp: nextTimestamp,
        valuation: latestValuation,
        volume: 0,
      }
    }
    curTimestamp = nextTimestamp
  }

  return inRangeData
}

const mergePoolsData = (
  longPool: MarketHistoryDataMap,
  shortPool: MarketHistoryDataMap
): MarketHistoryDataMap => {
  const dataMap: MarketHistoryDataMap = {}
  // long pool doesn't need to care if there's existing data for that timestamp
  Object.entries(longPool).forEach(([timestamp, data]) => {
    dataMap[+timestamp] = data
  })
  // short pool will check if there's existing data for each timestamp, if so, merge them
  Object.entries(shortPool).forEach(([shortTimestamp, data]) => {
    if (dataMap[+shortTimestamp]) {
      const { liquidity, timestamp, valuation, volume } = dataMap[+shortTimestamp]
      const sumLiquidity =
        liquidity === undefined && data.liquidity === undefined
          ? undefined
          : (liquidity ?? 0) + (data.liquidity ?? 0)
      dataMap[+shortTimestamp] = {
        liquidity: sumLiquidity,
        timestamp,
        // if longPool has no valuation for that timestamp, use shortPool's
        valuation: valuation === 0 ? data.valuation : valuation,
        volume: volume + data.volume,
      }
    } else {
      dataMap[+shortTimestamp] = data
    }
  })

  return dataMap
}

export const formatMarketHistoricalData = (
  { longTokenPool, shortTokenPool }: NormalizedMarketHistoricalData,
  options: FormatPoolsHistoricalDatasOptions
): MarketHistoryData[] => {
  if (!shortTokenPool && !longTokenPool) return []
  const longPoolData = filterAndBackfillData(longTokenPool || [], {
    tokenType: 'long',
    ...options,
  })
  const shortPoolData = filterAndBackfillData(shortTokenPool || [], {
    tokenType: 'short',
    ...options,
  })

  return Object.values(mergePoolsData(longPoolData, shortPoolData)).map((data) => data)
}

const normalizePoolCommonData = (
  data: Omit<PoolHourData, 'periodStartUnix'> & Omit<PoolDayData, 'date'>
): Omit<NormalizedPoolHistoricalData, 'timestamp'> => {
  // for some reason, values are being trimmed, maybe last(0.15.0) mst-gql fixes it
  const item = data.id
    ? data
    : (data as unknown as { $treenode: { value: typeof data } }).$treenode.value
  const { id, liquidity, pool, token0Price, volumeToken0, token1Price, volumeToken1, sqrtPrice } =
    item
  return {
    id,
    liquidity: +liquidity,
    token0: {
      id: pool.token0.id,
      price: token0Price,
      volume: volumeToken0,
      totalValueLocked: 0,
    },
    token1: {
      id: pool.token1.id,
      price: token1Price,
      volume: volumeToken1,
      totalValueLocked: 0,
    },
    sqrtPrice: +sqrtPrice,
  }
}

const normalizeHourData = ({
  periodStartUnix,
  ...props
}: PoolHourData): NormalizedPoolHistoricalData => ({
  timestamp: periodStartUnix,
  ...normalizePoolCommonData(props),
})

const normalizeDayData = ({ date, ...props }: PoolDayData): NormalizedPoolHistoricalData => ({
  timestamp: date,
  ...normalizePoolCommonData(props),
})

export const normalizePoolsHourDatas = ({
  longTokenPool,
  shortTokenPool,
}: PoolsHourDatas): NormalizedMarketHistoricalData => ({
  longTokenPool: longTokenPool?.map(normalizeHourData),
  shortTokenPool: shortTokenPool?.map(normalizeHourData),
})

export const normalizePoolsDayDatas = ({
  longTokenPool,
  shortTokenPool,
}: PoolsDayDatas): NormalizedMarketHistoricalData => ({
  longTokenPool: longTokenPool?.map(normalizeDayData),
  shortTokenPool: shortTokenPool?.map(normalizeDayData),
})

const normalizePoolData = ({
  liquidity,
  token0,
  token1,
  totalValueLockedToken0,
  totalValueLockedToken1,
  volumeToken0,
  volumeToken1,
}: PoolData): NormalizedPoolData => ({
  liquidity: +liquidity,
  token0: {
    ...token0,
    totalValueLocked: +totalValueLockedToken0,
    volume: +volumeToken0,
  },
  token1: {
    ...token1,
    totalValueLocked: +totalValueLockedToken1,
    volume: +volumeToken1,
  },
})

export const normalizePoolsData = (poolsData?: PoolsData): NormalizedPoolsData | undefined => {
  if (!poolsData) return undefined
  const { longTokenPool, shortTokenPool } = poolsData
  return {
    longTokenPool: normalizePoolData(longTokenPool),
    shortTokenPool: normalizePoolData(shortTokenPool),
  }
}

export const syncLatestData = (
  historicalDatas: MarketHistoryData[],
  type: HistoricalDataQueryType,
  latestDatas?: MarketHistoryData[]
): MarketHistoryData[] => {
  if (!latestDatas || latestDatas.length < 1) return historicalDatas
  const latestHistoricalData = historicalDatas[historicalDatas.length - 1]
  const latestData = latestDatas[0]

  // only update in 2 situations
  // update same window data: latestData's timestamp is exactly same as historicalData's latest timestamp
  // update new window data: latestData's timestamp is at most 1 day/hour larger than historicalData's latest timestamp
  const newHistoricalDatas = historicalDatas
  const interval = getIntervalInUnix(type)
  const sameWindow = latestData.timestamp === latestHistoricalData.timestamp
  const newWindow = latestData.timestamp > latestHistoricalData.timestamp
  const withinInterval = latestData.timestamp < latestHistoricalData.timestamp + interval
  if (sameWindow) {
    newHistoricalDatas[newHistoricalDatas.length - 1] = latestData
  } else if (newWindow && withinInterval) {
    newHistoricalDatas.push(latestData)
  }

  return newHistoricalDatas
}
