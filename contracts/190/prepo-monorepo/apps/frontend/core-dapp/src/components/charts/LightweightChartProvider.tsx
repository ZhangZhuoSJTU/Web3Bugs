import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { LightWeightCharts } from './chart-types'

const StoreContext = createContext<LightWeightCharts | undefined>(undefined)

export const LightWeightChartProvider: React.FC = ({ children }) => {
  const [lightWeightCharts, setLightWeightCharts] = useState<LightWeightCharts | undefined>()

  const loadLightWeightCharts = useCallback(async () => {
    // only load lightweight-charts once
    // this needs to be dynamically loaded (ref: https://github.com/tradingview/lightweight-charts/issues/543#issuecomment-686421467)
    const importedLightWeightCharts = await import('lightweight-charts')
    setLightWeightCharts(importedLightWeightCharts)
  }, [])

  useEffect(() => {
    loadLightWeightCharts()
  }, [loadLightWeightCharts])

  return <StoreContext.Provider value={lightWeightCharts}>{children}</StoreContext.Provider>
}

export const useLightWeightCharts = (): LightWeightCharts | undefined => useContext(StoreContext)
