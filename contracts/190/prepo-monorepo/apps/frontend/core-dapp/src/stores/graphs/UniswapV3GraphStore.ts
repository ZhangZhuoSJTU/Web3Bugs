import { SEC_IN_MS } from 'prepo-constants'
import { GraphStore, OnNewDataOptions, OnNewDataOutput } from 'prepo-stores'
import { makeObservable, observable } from 'mobx'
import {
  latestPoolsDayDatasQueryString,
  latestPoolsHourDatasQueryString,
  poolsDayDatasQueryString,
  poolsHourDatasQueryString,
  poolsQueryString,
} from './queries/uniswapV3.queries'
import { RootStore as UniswapV3RootStore } from '../../../generated/mst-gql/uniswap-v3/RootStore'
import { PROJECT_START_TIMESTAMP } from '../../lib/constants'
import { SupportedContracts } from '../../lib/contract.types'
import { PoolsData, PoolsDayDatas, PoolsHourDatas } from '../../types/market.types'
import { RootStore } from '../RootStore'

export const UNISWAP_MAX_SKIP = 5000
export const UNISWAP_MAX_FIRST = 1000
export const UNISWAP_MAX_DATAPOINTS = UNISWAP_MAX_FIRST + UNISWAP_MAX_SKIP

type SharedPoolsDataType<PoolDataType> = {
  longTokenPool?: PoolDataType[]
  shortTokenPool?: PoolDataType[]
}

const handleNewHistoricalPoolData =
  <PoolDataType>(maxData: number) =>
  (
    currentData: SharedPoolsDataType<PoolDataType>,
    newData: SharedPoolsDataType<PoolDataType>,
    { count }: OnNewDataOptions
  ): OnNewDataOutput<SharedPoolsDataType<PoolDataType>> => {
    const data = {
      longTokenPool: currentData?.longTokenPool || [],
      shortTokenPool: currentData?.shortTokenPool || [],
    }
    if (newData.longTokenPool === undefined || newData.shortTokenPool === undefined) {
      return { allFound: false }
    }

    data.longTokenPool = [...data.longTokenPool, ...newData.longTokenPool]
    data.shortTokenPool = [...data.shortTokenPool, ...newData.shortTokenPool]

    const longPoolDone =
      data.longTokenPool.length >= maxData || newData.longTokenPool.length < count
    const shortPoolDone =
      data.shortTokenPool.length >= maxData || newData.shortTokenPool.length < count

    return { allFound: longPoolDone && shortPoolDone, data }
  }

export class UniswapV3GraphStore extends GraphStore<RootStore, SupportedContracts> {
  constructor(root: RootStore) {
    super(root, 'uniswapV3', UniswapV3RootStore)
    makeObservable(this, { poolsQuery: observable, poolsDayDatas: observable })
  }

  poolsQuery(longTokenPoolId: string, shortTokenPoolId: string): PoolsData | undefined {
    return this.query<PoolsData>(poolsQueryString, { longTokenPoolId, shortTokenPoolId })?.data
  }

  historicalDailyData(
    longPoolId: string,
    shortPoolId: string,
    endTimeInMs: number,
    days: number
  ): PoolsDayDatas | undefined {
    return this.continuousQuery<PoolsDayDatas, unknown>(
      poolsDayDatasQueryString,
      {
        longPoolId,
        shortPoolId,
        startTime: PROJECT_START_TIMESTAMP,
        endTime: Math.floor(endTimeInMs / SEC_IN_MS),
        first: days,
      },
      {
        maxDataPerFetch: Math.min(days, UNISWAP_MAX_FIRST),
        onNewData: handleNewHistoricalPoolData(days),
      }
    )?.data
  }

  historicalHourlyData(
    longPoolId: string,
    shortPoolId: string,
    endTimeInMs: number,
    hours: number
  ): PoolsHourDatas | undefined {
    return this.continuousQuery<PoolsHourDatas, unknown>(
      poolsHourDatasQueryString,
      {
        longPoolId,
        shortPoolId,
        startTime: PROJECT_START_TIMESTAMP,
        endTime: Math.floor(endTimeInMs / SEC_IN_MS),
        first: hours,
      },
      {
        maxDataPerFetch: Math.min(hours, UNISWAP_MAX_FIRST),
        onNewData: handleNewHistoricalPoolData(hours),
      }
    )?.data
  }

  poolsDayDatas(longPoolId: string, shortPoolId: string): PoolsDayDatas | undefined {
    return this.query<PoolsDayDatas>(latestPoolsDayDatasQueryString, {
      longPoolId,
      shortPoolId,
    })?.data
  }

  poolsHourDatas(longPoolId: string, shortPoolId: string): PoolsHourDatas | undefined {
    return this.query<PoolsHourDatas>(latestPoolsHourDatasQueryString, {
      longPoolId,
      shortPoolId,
    })?.data
  }
}
