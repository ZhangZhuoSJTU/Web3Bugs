import { action, makeAutoObservable, observable, runInAction } from 'mobx'
import { RootStore } from './RootStore'
import { MarketEntity } from './entities/MarketEntity'
import { markets } from '../lib/markets'
import { MarketType } from '../types/market.types'

export class MarketStore {
  root: RootStore
  markets: {
    [key: string]: MarketEntity
  } = {}
  fetchingMarkets = false
  searchQuery: string

  constructor(root: RootStore) {
    this.root = root
    this.searchQuery = ''
    makeAutoObservable(this, {
      searchQuery: observable,
      setSearchQuery: action.bound,
    })
    this.init()
  }

  init(): void {
    try {
      this.fetchMarkets()
    } catch (e) {
      this.root.toastStore.errorToast('Error initializing markets', e)
    }
  }

  async fetchMarkets(): Promise<void> {
    try {
      runInAction(() => {
        this.fetchingMarkets = true
      })
      // Change to object
      const entities = markets.map((market) => new MarketEntity(this.root, market))

      await Promise.all(entities.map((entity) => entity.fetchPools()))

      runInAction(() => {
        this.markets = entities.reduce(
          (value, market) => ({
            ...value,
            [market.urlId]: market,
          }),
          {}
        )
      })
    } catch (e) {
      this.root.toastStore.errorToast('Error fetching markets', e)
    } finally {
      runInAction(() => {
        this.fetchingMarkets = false
      })
    }
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query
  }

  get searchKeyWords(): { label: string; value: string }[] {
    if (!this.markets) return []
    return Object.entries(this.markets).map(([value, market]) => ({ label: market.name, value }))
  }

  get filteredIpoMarkets(): MarketEntity[] {
    return MarketStore.getFilteredByType(this.getFilteredMarkets(), 'preIPO')
  }

  get filteredIcoMarkets(): MarketEntity[] {
    return MarketStore.getFilteredByType(this.getFilteredMarkets(), 'preICO')
  }

  get filteredMarkets(): MarketEntity[] {
    return MarketStore.getFilteredByType(this.getFilteredMarkets())
  }

  private static getFilteredByType = (records: MarketEntity[], type?: MarketType): MarketEntity[] =>
    records.filter((record) => type === undefined || record.type === type)

  private getFilteredMarkets = (): MarketEntity[] => {
    if (!this.markets) return []
    const marketsList = Object.keys(this.markets).map((marketName) => this.markets[marketName])
    if (this.searchQuery === '') return marketsList

    return marketsList.filter((market) =>
      market.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    )
  }
}
