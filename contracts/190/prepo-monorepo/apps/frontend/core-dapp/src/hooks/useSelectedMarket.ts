import { useMemo } from 'react'
import { useRouter } from 'next/router'
import { useRootStore } from '../context/RootStoreProvider'
import { MarketEntity } from '../stores/entities/MarketEntity'

const useSelectedMarket = (): MarketEntity | undefined => {
  const { query } = useRouter()
  const selectedMarketName = query?.marketUrlId
  const { marketStore } = useRootStore()

  return useMemo(
    () =>
      typeof selectedMarketName === 'string' ? marketStore.markets[selectedMarketName] : undefined,
    [marketStore.markets, selectedMarketName]
  )
}

export default useSelectedMarket
