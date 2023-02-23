import {
  DeepPartial,
  ChartOptions,
  AreaStyleOptions,
  SeriesOptionsCommon,
} from 'lightweight-charts'
import { LineStyle } from './chart-types'

export const defaultChartOptions: DeepPartial<ChartOptions> = {
  crosshair: {
    horzLine: {
      visible: false,
    },
    vertLine: {
      color: '#C2FEB3',
      visible: true,
      labelVisible: false,
      width: 1,
      style: LineStyle.Solid,
    },
  },
  grid: {
    vertLines: {
      color: '#fff',
      visible: false,
    },
    horzLines: {
      color: '#fff',
      visible: false,
    },
  },
  handleScale: false,
  handleScroll: false,
  kineticScroll: {
    touch: false,
    mouse: false,
  },
  rightPriceScale: {
    visible: false,
  },
  timeScale: {
    borderVisible: false,
    visible: true,
  },
}

export const defaultAreaSeriesOptions: DeepPartial<AreaStyleOptions & SeriesOptionsCommon> = {
  bottomColor: 'rgba(39, 174, 96, 0)',
  crosshairMarkerBackgroundColor: '#27AE60',
  lineColor: '#27AE60',
  lineWidth: 2,
  priceLineVisible: false,
  topColor: 'rgba(39, 174, 96, 0.27)',
}
