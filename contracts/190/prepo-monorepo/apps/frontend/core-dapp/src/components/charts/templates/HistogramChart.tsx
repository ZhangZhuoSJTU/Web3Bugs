import {
  ChartOptions,
  DeepPartial,
  SeriesPartialOptionsMap,
  UTCTimestamp,
} from 'lightweight-charts'
import { ChartTooltipFormatter } from '../chart-types'
import { ChartTimeframe } from '../../../types/market.types'
import Chart from '../Chart'
import { renderFloatingCardWithChartDetails } from '../FloatingCard'

export type HistogramDataProps = {
  time: number | string
  value?: number
  color?: string
}

export type HistogramData = HistogramDataProps[]

type Props = {
  chartOptions?: DeepPartial<ChartOptions>
  data: HistogramData
  chartTooltipFormatter?: ChartTooltipFormatter
  options?: SeriesPartialOptionsMap['Histogram']
  timeframe?: ChartTimeframe
}

const HistogramChart: React.FC<Props> = ({
  chartOptions,
  data,
  chartTooltipFormatter,
  options,
  timeframe,
}) => (
  <Chart
    chartOptions={chartOptions}
    series={[
      {
        data: data.map(({ time, value, color }) => ({ time: time as UTCTimestamp, value, color })),
        options,
        chartTooltip: {
          renderer: renderFloatingCardWithChartDetails,
          formatter: chartTooltipFormatter,
        },
        seriesType: 'Histogram',
      },
    ]}
    timeframe={timeframe}
  />
)

export default HistogramChart
