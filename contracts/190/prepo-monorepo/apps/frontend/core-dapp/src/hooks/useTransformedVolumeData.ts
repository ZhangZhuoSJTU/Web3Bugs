import { useMemo } from 'react'
import { Color, useTheme } from 'styled-components'
import { ChartTimeframe, MarketHistoryData } from '../types/market.types'
import { HistogramData } from '../components/charts/templates/HistogramChart'

type Options = {
  timeframe?: ChartTimeframe
  timestampInSeconds?: boolean
  baseColor?: keyof Color
  negativeColor?: keyof Color
}

const useTransformedVolumeData = (
  data: MarketHistoryData[] | undefined,
  { baseColor, negativeColor }: Options
): HistogramData | undefined => {
  const { color } = useTheme()
  return useMemo(() => {
    if (!data) return undefined
    const volumeData: HistogramData = []

    data.reduce(({ valuation: prevValuation }, { liquidity, timestamp, valuation, volume }) => {
      let barColor = color[baseColor ?? 'success']
      if (valuation !== undefined && prevValuation !== undefined && valuation < prevValuation)
        barColor = color[negativeColor ?? 'error']

      volumeData.push({ time: timestamp, value: volume, color: barColor })
      // this return is only to silent reduce expecting a return value
      return { liquidity, timestamp, valuation, volume }
    })

    return volumeData
  }, [baseColor, color, data, negativeColor])
}

export default useTransformedVolumeData
