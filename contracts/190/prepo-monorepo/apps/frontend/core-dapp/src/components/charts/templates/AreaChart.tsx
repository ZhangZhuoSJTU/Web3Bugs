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

export type AreaChartDataProps = {
  time: number | string
  value?: number
}

export type AreaChartData = AreaChartDataProps[]

type Props = {
  chartOptions?: DeepPartial<ChartOptions>
  data: AreaChartData
  chartTooltipFormatter?: ChartTooltipFormatter
  options?: SeriesPartialOptionsMap['Area']
  timeframe?: ChartTimeframe
}

const AreaChart: React.FC<Props> = ({
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
        data: data.map(({ time, value }) => ({ time: time as UTCTimestamp, value })),
        options,
        chartTooltip: {
          renderer: renderFloatingCardWithChartDetails,
          formatter: chartTooltipFormatter,
        },
        seriesType: 'Area',
      },
    ]}
    timeframe={timeframe}
  />
)

export default AreaChart
