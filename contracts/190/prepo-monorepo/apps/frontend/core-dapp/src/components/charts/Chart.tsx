import { ChartOptions, DeepPartial } from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import deepmerge from 'deepmerge'
import ChartSeries from './ChartSeries'
import { useCreateChart, useCrossHairMove, useResizeChart } from './hooks'
import { ChartSeriesProps } from './chart-types'
import tickMarkFormatter from './utils'
import { ChartTimeframe } from '../../types/market.types'

type Props = {
  chartOptions?: DeepPartial<ChartOptions>
  series: ChartSeriesProps[]
  timeframe?: ChartTimeframe
}

const ChartContainer = styled.div`
  height: 100%;
  position: relative;
  width: 100%;
  z-index: 0;
`

const Chart: React.FC<Props> = ({ chartOptions, series, timeframe }) => {
  const [subscribe, setSubscribe] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const chart = useCreateChart({ chartOptions, container: containerRef.current })

  const crossHairPositioner = useCrossHairMove({ chart, containerRef, subscribe })
  useResizeChart({ container: containerRef.current, chart })

  // only subscribe to crosshair movement if series requires it
  useEffect(() => {
    if (series.length > 0) {
      series.find(({ chartTooltip }) => {
        if (chartTooltip?.renderer) {
          setSubscribe(true)
          return true
        }
        return false
      })
    }
  }, [series])

  // update options when changed
  useEffect(() => {
    if (chart && chartOptions) chart.applyOptions(chartOptions)
  }, [chart, chartOptions])

  // auto handle tick mark formatting if timeframe is defined
  useEffect(() => {
    if (chart && timeframe) {
      const options = deepmerge.all([
        chartOptions || {},
        { timeScale: { tickMarkFormatter: tickMarkFormatter(timeframe) } },
      ])
      chart.applyOptions(options)
    }
  }, [chart, chartOptions, timeframe])

  return (
    <ChartContainer ref={containerRef}>
      {series.map(({ data, options, chartTooltip, seriesType }) => (
        <ChartSeries
          chart={chart}
          crossHairPositioner={crossHairPositioner}
          data={data}
          key={`${seriesType}`}
          options={options}
          chartTooltip={chartTooltip}
          seriesType={seriesType}
        />
      ))}
    </ChartContainer>
  )
}

export default Chart
