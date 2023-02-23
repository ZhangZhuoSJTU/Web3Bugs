import { enableStaticRendering } from 'mobx-react-lite'
import { createContext, useContext } from 'react'
import { initializeStore } from './initializeStore'
import { RootStore } from '../stores/RootStore'

enableStaticRendering(typeof window === 'undefined')

const StoreContext = createContext<RootStore | undefined>(undefined)
StoreContext.displayName = 'StoreContext'

export const RootStoreProvider: React.FC = ({ children }) => {
  const initilizedRootStore = initializeStore()

  return <StoreContext.Provider value={initilizedRootStore}>{children}</StoreContext.Provider>
}

export const useRootStore = (): RootStore => {
  const context = useContext(StoreContext)
  if (context === undefined) {
    throw new Error('useRootStore must be used within RootStoreProvider')
  }

  return context
}
