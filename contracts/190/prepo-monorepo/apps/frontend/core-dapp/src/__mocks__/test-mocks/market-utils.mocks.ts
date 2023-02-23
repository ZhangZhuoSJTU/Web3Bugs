import {
  ChartTimeframe,
  FormatPoolsHistoricalDatasOptions,
  HistoricalDataQueryType,
  MarketHistoryData,
  NormalizedMarketHistoricalData,
  PoolDayDatas,
  PoolsDayDatas,
  Range,
} from '../../types/market.types'

export const mockPayoutRange: Range = [0.2, 0.8]
export const mockValuationRange: Range = [10000, 50000]
export const mockLongTokenAddress = '0xLongTokenAddress'
export const mockShortTokenAddress = '0xShortTokenAddress'
export const mockPreCTTokenAddress = '0xPreCTTokenAddress'
export const mockMarketDatas: { longTokenPrice: number; valuation: number }[] = [
  { longTokenPrice: 0.8, valuation: 50000 },
  { longTokenPrice: 0.5, valuation: 30000 },
  { longTokenPrice: 0.2, valuation: 10000 },
]

export const mockLongTokenPool = {
  pool: {
    token0: { id: mockLongTokenAddress },
    token1: { id: mockPreCTTokenAddress },
  },
}
// reverse the positions to make sure calculations will always work
export const mockShortTokenPool = {
  pool: {
    token0: { id: mockPreCTTokenAddress },
    token1: { id: mockShortTokenAddress },
  },
}

export const mockFormatPoolsDayDatasOptions: FormatPoolsHistoricalDatasOptions = {
  payoutRange: mockPayoutRange,
  startTimeInMs: 1640304000000, // // 24 December 2021 00:00:00 UTC
  tokenAddresses: {
    long: mockLongTokenAddress,
    short: mockShortTokenAddress,
  },
  valuationRange: mockValuationRange,
  type: HistoricalDataQueryType.DAY,
}

export const mockLongTokenPoolData: PoolDayDatas = [
  {
    date: 1640217600, // 23 December 2021 00:00:00
    id: '1',
    liquidity: 100,
    sqrtPrice: 100,
    token0Price: 2,
    token1Price: 0.5,
    volumeToken0: 200,
    volumeToken1: 100,
    ...mockLongTokenPool,
  },
  {
    date: 1640476800, // 26 December 2021 00:00:00
    id: '2',
    liquidity: 100,
    sqrtPrice: 100,
    token0Price: 1.25,
    token1Price: 0.8,
    volumeToken0: 300,
    volumeToken1: 150,
    ...mockLongTokenPool,
  },
  {
    date: 1640563200, // 27 December 2021 00:00:00
    id: '3',
    liquidity: 200,
    sqrtPrice: 100,
    token0Price: 1.66,
    token1Price: 0.6,
    volumeToken0: 400,
    volumeToken1: 200,
    ...mockLongTokenPool,
  },
  {
    date: 1640736000, // 29 December 2021 00:00:00
    id: '4',
    liquidity: 200,
    sqrtPrice: 100,
    token0Price: 1.4285,
    token1Price: 0.7,
    volumeToken0: 400,
    volumeToken1: 200,
    ...mockLongTokenPool,
  },
]

export const mockShortTokenPoolData: PoolDayDatas = [
  {
    date: 1640217600, // 23 December 2021 00:00:00
    id: '1',
    liquidity: 100,
    sqrtPrice: 100,
    token0Price: 0.5,
    token1Price: 2,
    volumeToken0: 100,
    volumeToken1: 200,
    ...mockShortTokenPool,
  },
  {
    date: 1640390400, // 25 December 2021 00:00:00
    id: '2',
    liquidity: 100,
    sqrtPrice: 100,
    token0Price: 0.2,
    token1Price: 5,
    volumeToken0: 150,
    volumeToken1: 300,
    ...mockShortTokenPool,
  },
  {
    date: 1640649600, // 28 December 2021 00:00:00
    id: '3',
    liquidity: 200,
    sqrtPrice: 100,
    token0Price: 0.4,
    token1Price: 2.5,
    volumeToken0: 200,
    volumeToken1: 400,
    ...mockShortTokenPool,
  },
  {
    date: 1640736000, // 29 December 2021 00:00:00
    id: '4',
    liquidity: 200,
    sqrtPrice: 100,
    token0Price: 0.3,
    token1Price: 3.33,
    volumeToken0: 200,
    volumeToken1: 400,
    ...mockShortTokenPool,
  },
]

export const mockPoolsDayDatas: PoolsDayDatas = {
  longTokenPool: mockLongTokenPoolData,
  shortTokenPool: mockShortTokenPoolData,
}

export const mockNormalizedPoolsDayDatas: NormalizedMarketHistoricalData = {
  longTokenPool: [
    {
      id: '1',
      liquidity: 100,
      sqrtPrice: 100,
      timestamp: 1640217600,
      token0: { id: '0xLongTokenAddress', price: 2, volume: 200, totalValueLocked: 0 },
      token1: { id: '0xPreCTTokenAddress', price: 0.5, volume: 100, totalValueLocked: 0 },
    },
    {
      id: '2',
      liquidity: 100,
      sqrtPrice: 100,
      timestamp: 1640476800,
      token0: { id: '0xLongTokenAddress', price: 1.25, volume: 300, totalValueLocked: 0 },
      token1: { id: '0xPreCTTokenAddress', price: 0.8, volume: 150, totalValueLocked: 0 },
    },
    {
      id: '3',
      liquidity: 200,
      sqrtPrice: 100,
      timestamp: 1640563200,
      token0: { id: '0xLongTokenAddress', price: 1.66, volume: 400, totalValueLocked: 0 },
      token1: { id: '0xPreCTTokenAddress', price: 0.6, volume: 200, totalValueLocked: 0 },
    },
    {
      id: '4',
      liquidity: 200,
      sqrtPrice: 100,
      timestamp: 1640736000,
      token0: { id: '0xLongTokenAddress', price: 1.4285, volume: 400, totalValueLocked: 0 },
      token1: { id: '0xPreCTTokenAddress', price: 0.7, volume: 200, totalValueLocked: 0 },
    },
  ],
  shortTokenPool: [
    {
      id: '1',
      liquidity: 100,
      sqrtPrice: 100,
      timestamp: 1640217600,
      token0: { id: '0xPreCTTokenAddress', price: 0.5, volume: 100, totalValueLocked: 0 },
      token1: { id: '0xShortTokenAddress', price: 2, volume: 200, totalValueLocked: 0 },
    },
    {
      id: '2',
      liquidity: 100,
      sqrtPrice: 100,
      timestamp: 1640390400,
      token0: { id: '0xPreCTTokenAddress', price: 0.2, volume: 150, totalValueLocked: 0 },
      token1: { id: '0xShortTokenAddress', price: 5, volume: 300, totalValueLocked: 0 },
    },
    {
      id: '3',
      liquidity: 200,
      sqrtPrice: 100,
      timestamp: 1640649600,
      token0: { id: '0xPreCTTokenAddress', price: 0.4, volume: 200, totalValueLocked: 0 },
      token1: { id: '0xShortTokenAddress', price: 2.5, volume: 400, totalValueLocked: 0 },
    },
    {
      id: '4',
      liquidity: 200,
      sqrtPrice: 100,
      timestamp: 1640736000,
      token0: { id: '0xPreCTTokenAddress', price: 0.3, volume: 200, totalValueLocked: 0 },
      token1: { id: '0xShortTokenAddress', price: 3.33, volume: 400, totalValueLocked: 0 },
    },
  ],
}

export const mockedTimeframes = [ChartTimeframe.DAY, ChartTimeframe.WEEK]
export const mockedFormattedMarketData: MarketHistoryData[] = [
  {
    timestamp: 1646092800, // 1 March 2022 00:00:00
    liquidity: 1000,
    volume: 1000,
    valuation: 1000,
  },
  {
    timestamp: 1646179200, // 2 March 2022 00:00:00
    liquidity: 1500,
    volume: 0,
    valuation: 1000,
  },
  {
    timestamp: 1646265600, // 3 March 2022 00:00:00
    liquidity: 1200,
    volume: 400,
    valuation: 1100,
  },
  {
    timestamp: 1646352000, // 4 March 2022 00:00:00
    liquidity: 1300,
    volume: 2000,
    valuation: 1600,
  },
  {
    timestamp: 1646438400, // 5 March 2022 00:00:00
    liquidity: 1400,
    volume: 2200,
    valuation: 1500,
  },
]
