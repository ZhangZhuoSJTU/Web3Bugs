import { IconName } from 'prepo-ui'
import {
  PoolModelType,
  PoolDayDataModelType,
  TokenModelType,
  PoolHourDataModelType,
} from '../../generated/mst-gql/uniswap-v3'
import { SupportedMarkets } from '../lib/markets-contracts'
import { SupportedMarketPools } from '../lib/markets-pool-contracts'
import { SupportedMarketTokens } from '../lib/markets-tokens-contracts'

export enum HistoricalDataQueryType {
  HOUR = 'HOUR',
  DAY = 'DAY',
}

export enum ChartView {
  VALUATION = 'Valuation',
  VOLUME = 'Volume',
  LIQUIDITY = 'Liquidity',
}

export enum ChartTimeframe {
  DAY = '1D',
  WEEK = '7D',
  MONTH = '1M',
  YEAR = '1Y',
  MAX = 'MAX',
}

export type Range = [number, number]

export type SupportedMarketID = 'fakestock' | 'faketoken'

export type MarketType = 'preICO' | 'preIPO'

export type Market = {
  iconName: IconName
  type: MarketType
  name: string
  urlId: SupportedMarketID
  companyName: string
  address: SupportedMarkets
  long: {
    tokenAddress: SupportedMarketTokens
    poolAddress: SupportedMarketPools
  }
  short: {
    tokenAddress: SupportedMarketTokens
    poolAddress: SupportedMarketPools
  }
  static: {
    valuationRange: Range
  }
}

export type MarketHistoryData = {
  timestamp: number
  volume: number
  valuation?: number
  liquidity?: number
}

export type NumberData = {
  percent?: number
  denominated?: number
  value: number
}

export type TokensId = {
  token0: Pick<TokenModelType, 'id'>
  token1: Pick<TokenModelType, 'id'>
}

export type PoolTokensId = { pool: TokensId }

export type PoolData = Pick<
  PoolModelType,
  | 'volumeUSD'
  | 'totalValueLockedUSD'
  | 'totalValueLockedToken0'
  | 'totalValueLockedToken1'
  | 'volumeToken0'
  | 'volumeToken1'
  | 'liquidity'
> &
  TokensId

export type PoolsData = {
  longTokenPool: PoolData
  shortTokenPool: PoolData
}

export type PoolDayData = Pick<
  PoolDayDataModelType,
  | 'date'
  | 'liquidity'
  | 'token0Price'
  | 'token1Price'
  | 'id'
  | 'sqrtPrice'
  | 'volumeToken0'
  | 'volumeToken1'
> &
  PoolTokensId

export type PoolDayDatas = PoolDayData[]

export type PoolsDayDatas = {
  longTokenPool?: PoolDayDatas
  shortTokenPool?: PoolDayDatas
}

export type PoolHourData = Pick<
  PoolHourDataModelType,
  | 'id'
  | 'liquidity'
  | 'periodStartUnix'
  | 'sqrtPrice'
  | 'token0Price'
  | 'token1Price'
  | 'volumeToken0'
  | 'volumeToken1'
> &
  PoolTokensId

export type PoolHourDatas = PoolHourData[]

export type PoolsHourDatas = {
  longTokenPool?: PoolHourDatas
  shortTokenPool?: PoolHourDatas
}

export type MarketHistoryDataMap = {
  [timestamp: number]: MarketHistoryData
}

// market utils types

export type FormatPoolsHistoricalDatasOptions = {
  payoutRange: Range
  tokenAddresses: {
    long: string
    short: string
  }
  valuationRange: Range
  endTimeInMs?: number
  startTimeInMs?: number
  type: HistoricalDataQueryType
}

export type CalculateValuationParams = {
  longTokenPrice: number
} & Omit<
  FormatPoolsHistoricalDatasOptions,
  'tokenAddresses' | 'endTimeInMs' | 'startTimeInMs' | 'type'
>

export type FormatPoolDayDataOptions = {
  tokenType: 'long' | 'short'
} & Omit<CalculateValuationParams, 'longTokenPrice' | 'tokenAddresses'>

export type NormalizedToken = {
  id: string
  volume: number
  price: number
  totalValueLocked: number
}

export type NormalizedTokenPair = {
  token0: NormalizedToken
  token1: NormalizedToken
}

export type NormalizedTokenPairWithPriceOnly = {
  token0: Pick<NormalizedToken, 'id' | 'price'>
  token1: Pick<NormalizedToken, 'id' | 'price'>
}

export type NormalizedTokenPairWithoutPrice = {
  token0: Omit<NormalizedToken, 'price'>
  token1: Omit<NormalizedToken, 'price'>
}

export type NormalizedTokenPairWithTvlOnly = {
  token0: Pick<NormalizedToken, 'id' | 'volume'>
  token1: Pick<NormalizedToken, 'id' | 'volume'>
}

export type NormalizedTokenPairWithVolumeOnly = {
  token0: Pick<NormalizedToken, 'id' | 'volume'>
  token1: Pick<NormalizedToken, 'id' | 'volume'>
}

export type NormalizedPoolData = { liquidity: number } & NormalizedTokenPairWithoutPrice

export type NormalizedPoolsData = {
  longTokenPool: NormalizedPoolData
  shortTokenPool: NormalizedPoolData
}

export type NormalizedPoolHistoricalData = {
  id: string
  timestamp?: number
  liquidity: number
  sqrtPrice: number
} & NormalizedTokenPair

export type NormalizedMarketHistoricalData = {
  longTokenPool?: NormalizedPoolHistoricalData[]
  shortTokenPool?: NormalizedPoolHistoricalData[]
}

export type SliderSettings = {
  min: number
  max: number
  currentValuation: number
}

export type ExitProfitLoss = {
  currentValuationPayout: number
  exitValuationPayout: number
  expectedProfitLossPercentage: number
  expectedProfitLoss: number
  finalInvestmentValue: number
}
