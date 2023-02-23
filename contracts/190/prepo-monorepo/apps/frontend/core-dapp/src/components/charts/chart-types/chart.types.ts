import { RefObject } from 'react'
import {
  ChartOptions,
  DeepPartial,
  IChartApi,
  ISeriesApi,
  Point,
  SeriesType,
  Time,
} from 'lightweight-charts'
import { ChartTimeframe } from '../../../types/market.types'

export type Position = {
  bottom: number | 'auto'
  left: number | 'auto'
  right: number | 'auto'
  top: number | 'auto'
}

export type DetailsProps = {
  point: Point
  position: Position
  price: number
  time: Time
  timeframe?: ChartTimeframe
}

export type CrossHairPositionerProps = {
  detailsBoxRef: RefObject<HTMLElement>
  series?: ISeriesApi<SeriesType>
}

export type CrossHairPositioner = (props: CrossHairPositionerProps) => DetailsProps | undefined

export enum LineStyle {
  Solid = 0,
  Dotted = 1,
  Dashed = 2,
  LargeDashed = 3,
  SparseDotted = 4,
}

export enum ColorType {
  Solid = 'solid',
  VerticalGradient = 'gradient',
}

export type LightWeightCharts = {
  createChart: (
    container: string | HTMLElement,
    options?: DeepPartial<ChartOptions> | undefined
  ) => IChartApi
}
