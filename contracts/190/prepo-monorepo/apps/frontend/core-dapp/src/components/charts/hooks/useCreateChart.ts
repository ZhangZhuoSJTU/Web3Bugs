import { ChartOptions, DeepPartial, IChartApi } from 'lightweight-charts'
import { useCallback, useEffect, useState } from 'react'
import merge from 'deepmerge'
import { useLightWeightCharts } from '../LightweightChartProvider'
import { defaultChartOptions } from '../default-options'

type Props = {
  container?: HTMLElement | null
  chartOptions?: DeepPartial<ChartOptions>
}

const useCreateChart = ({ container, chartOptions }: Props): IChartApi | undefined => {
  const [chart, setChart] = useState<IChartApi>()
  const lightWeightChart = useLightWeightCharts()

  const initiateChart = useCallback(() => {
    if (!chart && lightWeightChart && container) {
      const { createChart } = lightWeightChart
      // replace this with deepMerge instead
      const options = merge.all([
        defaultChartOptions,
        chartOptions || {},
        {
          height: container.clientHeight,
          width: container.clientWidth,
        },
      ])
      const createdChart = createChart(container, options)

      setChart(createdChart)
    }
  }, [chart, chartOptions, container, lightWeightChart])

  useEffect(() => {
    initiateChart()
  }, [initiateChart])

  return chart
}

export default useCreateChart
