import { createContext, useContext } from 'react'
import { RootStore } from '../stores/RootStore'

const StoreContext = createContext<RootStore | undefined>(undefined)

// local module level variable - holds singleton store
let store: RootStore

// function to initialize the store
function initializeStore(): RootStore {
  const localStore = store ?? new RootStore()

  // For server side rendering always create a new store
  if (typeof window === 'undefined') return localStore

  // Create the store once in the client
  if (!store) store = localStore

  return localStore
}

// https://dev.to/ivandotv/mobx-server-side-rendering-with-next-js-4m18
export const RootStoreProvider: React.FC = ({ children }) => {
  // only create the store once (store is a singleton)
  const localStore = initializeStore()

  return <StoreContext.Provider value={localStore}>{children}</StoreContext.Provider>
}

export const useRootStore = (): RootStore => {
  const context = useContext(StoreContext)
  if (context === undefined) {
    throw new Error('useRootStore must be used within RootStoreProvider')
  }

  return context
}
