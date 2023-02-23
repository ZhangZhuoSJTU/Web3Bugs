import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useRootStore } from '../../context/RootStoreProvider'

const useTradePage = (): void => {
  const router = useRouter()
  const { marketStore, tradeStore } = useRootStore()
  const { markets } = marketStore

  useEffect(() => {
    if (router.query) {
      const { action, marketId, direction } = router.query

      // handle direction selection
      if (typeof action === 'string') {
        tradeStore.setAction(action === 'close' ? 'close' : 'open')
      }

      // handle market selcetion by marketId
      if (typeof marketId === 'string') {
        tradeStore.setSelectedMarket(marketId)
      }

      // handle direction selection
      if (typeof direction === 'string') {
        tradeStore.setDirection(direction === 'short' ? 'short' : 'long')
      }

      // TODO: add support for market selection by market address
    }
  }, [markets, router.query, tradeStore])
}

export default useTradePage
