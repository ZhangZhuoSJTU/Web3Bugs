import { useEffect, useMemo, useRef } from 'react'
import useApplyChartSeries from './hooks/useApplyChartSeries'
import { ChartSeriesProps, CrossHairPositioner } from './chart-types'

type Props = {
  crossHairPositioner: CrossHairPositioner
}

export const ChartSeries: React.FC<ChartSeriesProps & Props> = ({
  chart,
  crossHairPositioner,
  data,
  options,
  chartTooltip,
  seriesType,
}) => {
  const detailsBoxRef = useRef<HTMLDivElement>(null)
  const series = useApplyChartSeries({ chart, data, options, seriesType })

  // chart is buggy without resetting time scale on data change
  // it will be blank until user tries to manually scale it
  useEffect(() => {
    if (series) {
      series.setData(data)
      chart?.timeScale().fitContent()
    }
  }, [chart, data, series])

  const details = useMemo(() => {
    const crossHairPosition = crossHairPositioner({ series, detailsBoxRef })
    if (!crossHairPosition) return undefined
    return {
      ...crossHairPosition,
    }
  }, [crossHairPositioner, series])

  if (typeof chartTooltip?.renderer !== 'function') return null

  return chartTooltip.renderer(
    detailsBoxRef,
    details,
    chartTooltip.formatter?.formatPrice,
    chartTooltip.formatter?.formatTime
  )
}

export default ChartSeries
