import { useCallback, useEffect, useRef } from 'react'
import { IChartApi } from 'lightweight-charts'

type Props = {
  chart?: IChartApi
  container?: HTMLElement | null
}

// we can reuse this on every charts from lightweight-charts
const useResizeChart = ({ chart, container }: Props): void => {
  const resizeRef = useRef<ResizeObserver>()

  const handleResize = useCallback(() => {
    if (!resizeRef.current && chart) {
      resizeRef.current = new ResizeObserver((entries) => {
        const { height, width } = entries[0].contentRect
        if (chart) chart.resize(width, height)
      })
      if (container) resizeRef.current.observe(container)
    }
  }, [chart, container])

  useEffect(() => {
    handleResize()
    return (): void => resizeRef.current?.disconnect()
  }, [handleResize])
}

export default useResizeChart
