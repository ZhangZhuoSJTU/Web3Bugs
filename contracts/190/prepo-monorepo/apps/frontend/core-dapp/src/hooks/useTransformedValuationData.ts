import { useMemo } from 'react'
import { AreaChartData } from '../components/charts/templates/AreaChart'
import { MarketHistoryData } from '../types/market.types'

const useTransformedValuationData = (
  data: MarketHistoryData[] | undefined
): AreaChartData | undefined =>
  useMemo(
    () => data?.map(({ timestamp, valuation }) => ({ time: timestamp, value: valuation })),
    [data]
  )

export default useTransformedValuationData
