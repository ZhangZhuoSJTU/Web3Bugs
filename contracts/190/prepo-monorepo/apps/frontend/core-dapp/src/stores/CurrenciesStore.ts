import { makeAutoObservable } from 'mobx'
import { RootStore } from './RootStore'
import { Currency } from '../types/currency.types'
import { usdc } from '../lib/supported-currencies'
import { KeyStringMap } from '../types/common.types'

// withdraw and deposit page should take their list of currencies from here instead of hard coded mock data
// because this store will handle balance of each currency
export class CurrenciesStore {
  root: RootStore
  disabledIds: KeyStringMap
  selectedIds: KeyStringMap

  constructor(root: RootStore) {
    this.root = root
    this.disabledIds = { usdc: true }
    this.selectedIds = { usdc: true }
    makeAutoObservable(this, {}, { autoBind: true })
  }

  deselectCurrency(id: string): void {
    delete this.selectedIds[id]
  }

  isCurrencySelected(id: string): boolean {
    return Boolean(this.selectedIds[id])
  }

  selectCurrency(id: string): void {
    if (this.selectedIds[id]) return
    this.selectedIds[id] = true
  }

  get currencies(): Currency[] {
    const defaultCurrencies = [this.usdcCurrency]
    // when we want to allow other currencies (e.g. any contract address users can paste)
    // we can keep track of a list of users pasted contract address (and do erc20 check during paste to make sure we can get balance here)
    // and get the balance dynamically here
    // makes more sense that currencies list is computed value since balance and value are computed
    return defaultCurrencies
  }

  get selectedCurrencies(): Currency[] {
    return this.currencies.filter(({ id }) => this.isCurrencySelected(id))
  }

  get usdcCurrency(): Currency {
    const { tokenBalance } = this.root.baseTokenStore
    return {
      ...usdc,
      balance: tokenBalance,
      value: tokenBalance,
    }
  }
}
