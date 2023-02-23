import { add } from 'date-fns'
import { makeAutoObservable } from 'mobx'
import cloneDeep from 'clone-deep'
import { RootStore } from '../../stores/RootStore'
import { Market } from '../../types/market.types'

type SelectedMarket = 'All' | Market

type FilterOptions = {
  selectedMarket: SelectedMarket
  dateRange: {
    start: Date | undefined
    end: Date | undefined
  }
  confirmedDateRange: {
    start: Date | undefined
    end: Date | undefined
  }
  selectedFilterTypes?: string[]
}

export class FilterStore {
  root: RootStore
  isFilterOpen = false
  isCalendarOpen = false
  filterOptions: FilterOptions = {
    selectedMarket: 'All',
    dateRange: {
      start: add(new Date(), { weeks: -1 }),
      end: new Date(),
    },
    confirmedDateRange: {
      start: add(new Date(), { weeks: -1 }),
      end: new Date(),
    },
  }
  currentFilter: FilterOptions

  constructor(root: RootStore) {
    this.root = root
    this.currentFilter = cloneDeep(this.filterOptions)
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setIsFilterOpen = (isFilterOpen: boolean): void => {
    this.isFilterOpen = isFilterOpen
  }

  setIsCalendarOpen(isCalendarOpen: boolean): void {
    this.isCalendarOpen = isCalendarOpen
  }

  setSelectedMarket(selectedMarket: SelectedMarket): void {
    this.filterOptions.selectedMarket = selectedMarket
  }

  setSelectedFilterTypes = (selectedFilterTypes?: string[]): void => {
    this.filterOptions.selectedFilterTypes = selectedFilterTypes
  }

  setDateRange(dateRange: { start: Date | undefined; end: Date | undefined }): void {
    this.filterOptions.dateRange = dateRange
  }

  resetFilters(): void {
    this.filterOptions = cloneDeep(this.currentFilter)
  }

  useConfirmedDateRange(): void {
    const { start, end } = this.filterOptions.confirmedDateRange
    if (start && end) {
      this.filterOptions.dateRange = { start, end }
    }
  }

  confirmDateRange(): void {
    const { start, end } = this.filterOptions.dateRange
    if (!start || !end) {
      return
    }
    this.filterOptions.confirmedDateRange = { start, end }
  }

  confirmChanges(): void {
    this.currentFilter = cloneDeep(this.filterOptions)
  }
}
