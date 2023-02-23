import { useMemo } from 'react'
import { AreaChartData } from '../components/charts/templates/AreaChart'
import { MarketHistoryData } from '../types/market.types'

const useTransformedTVLData = (data: MarketHistoryData[] | undefined): AreaChartData | undefined =>
  useMemo(
    () => data?.map(({ timestamp, liquidity }) => ({ time: timestamp, value: liquidity })),
    [data]
  )

export default useTransformedTVLData
