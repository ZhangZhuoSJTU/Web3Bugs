import { SEC_IN_MS } from 'prepo-constants'
import { TickMarkFormatter, Time } from 'lightweight-charts'
import { ChartTimeframe } from '../../types/market.types'
import {
  getDateAndLiteralMonthFromMs,
  getFullStringFromMs,
  getHourMinsFromMs,
} from '../../utils/date-utils'

export const numberChartTime = (seconds: Time): number => +seconds * SEC_IN_MS

export const hourFormatter: TickMarkFormatter = (seconds): string =>
  getHourMinsFromMs(numberChartTime(seconds))

export const dayFormatter: TickMarkFormatter = (seconds): string =>
  getDateAndLiteralMonthFromMs(numberChartTime(seconds))

const tickMarkFormatter = (timeframe: ChartTimeframe): TickMarkFormatter =>
  timeframe === ChartTimeframe.DAY ? hourFormatter : dayFormatter

export const formatChartTooltipTime = (time: Time): string =>
  getFullStringFromMs(numberChartTime(time))

export default tickMarkFormatter
