import { useCallback, useEffect, useState } from 'react'
import { ISeriesApi } from 'lightweight-charts'
import { defaultAreaSeriesOptions } from '../default-options'
import { ApplyChartSeriesProps, SeriesMap } from '../chart-types'

const seriesMap: SeriesMap = {
  Area: {
    apiKey: 'addAreaSeries',
    defaultOptions: defaultAreaSeriesOptions,
  },
  Baseline: {
    apiKey: 'addBaselineSeries',
  },
  Bar: {
    apiKey: 'addBarSeries',
  },
  Candlestick: {
    apiKey: 'addCandlestickSeries',
  },
  Histogram: {
    apiKey: 'addHistogramSeries',
  },
  Line: {
    apiKey: 'addLineSeries',
  },
}

const useApplyChartSeries = ({
  chart,
  data,
  options,
  seriesType,
}: ApplyChartSeriesProps): ISeriesApi<typeof seriesType> | undefined => {
  const [series, setSeries] = useState<ISeriesApi<typeof seriesType> | undefined>()
  const applySeries = useCallback(() => {
    if (chart && seriesMap[seriesType]) {
      const seriesObj = seriesMap[seriesType]
      // make sure the api to create series exists
      if (typeof chart[seriesObj.apiKey] === 'function') {
        const createdSeries = chart[seriesObj.apiKey]()
        if (seriesObj.defaultOptions) createdSeries.applyOptions(seriesObj.defaultOptions)
        setSeries(createdSeries)
      }
    }
  }, [chart, seriesType])

  useEffect(() => {
    applySeries()
  }, [applySeries])

  useEffect(() => {
    series?.setData(data)
  }, [series, data])

  useEffect(() => {
    if (series && options) {
      const curOptions = series.options()
      series.applyOptions({ ...curOptions, ...options })
    }
  }, [options, series])

  useEffect(
    () => (): void => {
      if (series) {
        try {
          chart?.removeSeries(series)
        } catch (e) {
          // removeSeries will throw error if it has already be cleaned from chart
          // but there is no interface to check whether it has been clean
          // we cam catch and ignore this
        }
      }
    },
    [chart, series]
  )

  return series
}

export default useApplyChartSeries
