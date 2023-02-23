import { makeAutoObservable, toJS } from 'mobx'
import { isWithinInterval } from 'date-fns'
import { PpoHistoryItem } from './ppo-history.types'
import { RootStore } from '../../../stores/RootStore'

const PPO_HISTORY_ITEMS_MOCK: PpoHistoryItem[] = []

export class PpoHistoryStore {
  historyItems: PpoHistoryItem[] = []

  constructor(public root: RootStore) {
    this.historyItems = PPO_HISTORY_ITEMS_MOCK
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get filteredHistoryItems(): PpoHistoryItem[] {
    return this.applyTypeFilter(this.applyDateFilter(this.historyItems))
  }

  get dataForExport(): PpoHistoryItem[] {
    const result = toJS(this.historyItems)

    return this.applyTypeFilter(this.applyDateFilter(result))
  }

  private applyTypeFilter(data: PpoHistoryItem[]): PpoHistoryItem[] {
    const { selectedFilterTypes } = this.root.filterStore.filterOptions
    if (!selectedFilterTypes) return data
    return data.filter(({ type }) => selectedFilterTypes.includes(type))
  }

  private applyDateFilter(data: PpoHistoryItem[]): PpoHistoryItem[] {
    const { start, end } = this.root.filterStore.filterOptions.confirmedDateRange
    if (start === undefined || end === undefined) return data

    return data.filter(({ timestamp }) =>
      isWithinInterval(new Date(timestamp * 1000), { start, end })
    )
  }
}
