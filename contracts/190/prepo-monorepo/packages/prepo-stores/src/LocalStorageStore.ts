import { observe, makeAutoObservable, toJS } from 'mobx'
import deepEqual from 'fast-deep-equal'
import { RootStore } from './RootStore'

export class LocalStorageStore<StorageType> {
  root: RootStore<unknown>
  private localStorageKey: string
  private windowLocalStorage: typeof window.localStorage | undefined
  storage: StorageType

  constructor(root: RootStore<unknown>, projectName: string, initStorage: StorageType) {
    this.root = root
    this.localStorageKey = `prepo.${projectName}`
    this.storage = initStorage
    makeAutoObservable(this)
  }

  load(): void {
    this.windowLocalStorage = window.localStorage
    this._loadLocalStorage()
  }

  private _loadLocalStorage = (): void => {
    const localStorage = this._getLocalStorage()

    if (Object.keys(localStorage).length > 0) {
      const isEqual = deepEqual(localStorage, toJS(this.storage))

      if (!isEqual) {
        this.storage = localStorage as unknown as StorageType
        this._setLocalStorage(localStorage)
      }
    }

    // Initializes localstorage if there is none
    this._setLocalStorage(this.storage)

    // Runs setLocalStorage everytime this.storage[X] changes
    // Keeps the LocalStorageStore synced with window.localstorage
    observe(this.storage, () => this._setLocalStorage(this.storage))
  }

  private _getLocalStorage = (): { [key: string]: string } => {
    if (!this.windowLocalStorage) return {}

    const jsonObject = this.windowLocalStorage.getItem(this.localStorageKey) || '{}'

    return JSON.parse(jsonObject)
  }

  private _setLocalStorage<T>(data: T): void {
    this.windowLocalStorage?.setItem(this.localStorageKey, JSON.stringify(data))
  }

  private _removeLocalStorage(): void {
    this.windowLocalStorage?.removeItem(this.localStorageKey)
  }
}
