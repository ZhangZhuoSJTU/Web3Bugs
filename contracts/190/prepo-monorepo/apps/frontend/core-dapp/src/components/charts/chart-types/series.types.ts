import { ReactElement, RefObject } from 'react'
import {
  IChartApi,
  SeriesDataItemTypeMap,
  SeriesPartialOptionsMap,
  SeriesType,
  Time,
} from 'lightweight-charts'
import { DetailsProps } from './chart.types'
import { ChartTimeframe } from '../../../types/market.types'

export type SeriesMap = Record<
  SeriesType,
  {
    apiKey: keyof Pick<
      IChartApi,
      | 'addAreaSeries'
      | 'addBarSeries'
      | 'addCandlestickSeries'
      | 'addHistogramSeries'
      | 'addLineSeries'
      | 'addBaselineSeries'
    >
    defaultOptions?: SeriesPartialOptionsMap[SeriesType]
  }
>

type SeriesBaseProps = {
  chart?: IChartApi
}

type AreaOptions = {
  data: SeriesDataItemTypeMap['Area'][]
  options?: SeriesPartialOptionsMap['Area']
  seriesType: 'Area'
} & SeriesBaseProps

type BaselineOptions = {
  data: SeriesDataItemTypeMap['Baseline'][]
  options?: SeriesPartialOptionsMap['Baseline']
  seriesType: 'Baseline'
} & SeriesBaseProps

type BarOptions = {
  data: SeriesDataItemTypeMap['Bar'][]
  options?: SeriesPartialOptionsMap['Bar']
  seriesType: 'Bar'
} & SeriesBaseProps

type CandlestickOptions = {
  data: SeriesDataItemTypeMap['Candlestick'][]
  options?: SeriesPartialOptionsMap['Candlestick']
  seriesType: 'Candlestick'
} & SeriesBaseProps

type HistogramOptions = {
  data: SeriesDataItemTypeMap['Histogram'][]
  options?: SeriesPartialOptionsMap['Histogram']
  seriesType: 'Histogram'
} & SeriesBaseProps

type LineOptions = {
  data: SeriesDataItemTypeMap['Line'][]
  options?: SeriesPartialOptionsMap['Line']
  seriesType: 'Line'
} & SeriesBaseProps

export type ApplyChartSeriesProps =
  | AreaOptions
  | BaselineOptions
  | BarOptions
  | CandlestickOptions
  | HistogramOptions
  | LineOptions

export type FormatPrice = (price: number) => string
export type FormatTime = (time: Time, timeframe?: ChartTimeframe) => string

export type ChartTooltipFormatter = {
  formatPrice?: FormatPrice
  formatTime?: FormatTime
}

export type ChartTooltip = {
  renderer: (
    ref: RefObject<HTMLDivElement>,
    details?: DetailsProps,
    formatPrice?: FormatPrice,
    formatTime?: FormatTime
  ) => ReactElement | null
  formatter?: ChartTooltipFormatter
}

export type ChartSeriesProps = {
  chartTooltip?: ChartTooltip
} & ApplyChartSeriesProps
