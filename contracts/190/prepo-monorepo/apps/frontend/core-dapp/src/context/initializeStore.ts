import { RootStore } from '../stores/RootStore'

let store: RootStore

export function initializeStore(): RootStore {
  const localStore = store ?? new RootStore()

  // For SSG and SSR always create a new store
  if (typeof window === 'undefined') return localStore
  // Create the store once in the client
  if (!store) store = localStore

  return localStore
}
