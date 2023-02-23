import { PpoItem, ppoItems } from './ppoItems'
import useFeatureFlag, { FeatureFlag } from '../../hooks/useFeatureFlag'
import { useRootStore } from '../../context/RootStoreProvider'
import { Routes } from '../../lib/routes'

const HIDDEN_NAVIGATION_ROUTES = [Routes.Withdraw]

const usePpoNavigation = (): Array<PpoItem> => {
  const { web3Store } = useRootStore()
  const { enabled, loading } = useFeatureFlag(
    FeatureFlag.enableCoreDapp,
    web3Store.signerState.address
  )

  return ppoItems.map((item) => ({
    ...item,
    href:
      (loading || !enabled) && HIDDEN_NAVIGATION_ROUTES.includes(item.href as Routes)
        ? ''
        : item.href,
  }))
}

export default usePpoNavigation
