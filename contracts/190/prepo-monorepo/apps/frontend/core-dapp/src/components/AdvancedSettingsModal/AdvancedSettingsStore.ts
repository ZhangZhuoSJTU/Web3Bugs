import { GasSpeed } from 'prepo-constants'
import { makeAutoObservable } from 'mobx'
import { RootStore } from '../../stores/RootStore'

const POINT_ONE_PERCENT = 0.001
const FIVE_PERCENT = 0.05
const ONE_POINT_FIVE_PERCENT = 0.015

export const SLIPPAGE_SETTINGS = {
  MINIMUM_SLIPPAGE: POINT_ONE_PERCENT,
  MAXIMUM_SLIPPAGE: FIVE_PERCENT,
  INITIAL_SLIPPAGE: ONE_POINT_FIVE_PERCENT,
}

export class AdvancedSettingsStore {
  root: RootStore
  isSettingsOpen = false
  savedSlippage = SLIPPAGE_SETTINGS.INITIAL_SLIPPAGE
  unsavedCustomGasPrice?: number
  unsavedGasSpeed?: GasSpeed
  unsavedSlippage?: number

  constructor(root: RootStore) {
    this.root = root
    makeAutoObservable(this, {}, { autoBind: true })
  }

  closeModal(): void {
    this.setUnsavedCustomGasPrice(undefined)
    this.setUnsavedGasSpeed(undefined)
    this.setUnsavedSlippage(undefined)
    this.setIsSettingsOpen(false)
  }

  onChangeCustomGasPrice(e: React.ChangeEvent<HTMLInputElement>): void {
    const isNumberRegex = /^[0-9.]*$/
    if (isNumberRegex.test(e.target.value)) {
      const value = parseInt(e.target?.value === '' ? '0' : e.target?.value, 10)
      this.setUnsavedCustomGasPrice(value)
      this.setUnsavedGasSpeed(GasSpeed.CUSTOM)
    }
  }

  setIsSettingsOpen(isSettingsOpen: boolean): void {
    this.isSettingsOpen = isSettingsOpen
  }

  setSavedSlippage(slippage: number): void {
    this.savedSlippage = slippage
  }

  setUnsavedCustomGasPrice(value?: number): void {
    this.unsavedCustomGasPrice = value
  }

  setUnsavedGasSpeed(gasSpeed?: GasSpeed): void {
    this.unsavedGasSpeed = gasSpeed
  }

  setUnsavedSlippage(slippage?: number): void {
    this.unsavedSlippage = slippage
  }

  resetValues(): void {
    this.savedSlippage = SLIPPAGE_SETTINGS.INITIAL_SLIPPAGE
    this.root.gasStore.reset()
    this.closeModal()
  }

  saveSettings(): void {
    const { setCustomGasPrice, setGasSpeed } = this.root.gasStore
    setCustomGasPrice(this.unsavedCustomGasPrice)
    setGasSpeed(this.gasSpeed)
    this.setSavedSlippage(this.slippage)
    this.closeModal()
  }

  get customGasPrice(): number {
    const { gasPriceOptionsNumber } = this.root.gasStore
    return this.unsavedCustomGasPrice ?? gasPriceOptionsNumber[GasSpeed.CUSTOM]
  }

  get invalidCustomGas(): boolean {
    return GasSpeed.CUSTOM && this.customGasPrice <= 0
  }

  get gasPrice(): number {
    const { gasPriceOptionsNumber } = this.root.gasStore
    if (this.gasSpeed === GasSpeed.CUSTOM) return this.customGasPrice
    return gasPriceOptionsNumber[this.gasSpeed]
  }

  get gasSpeed(): GasSpeed {
    return this.unsavedGasSpeed ?? this.root.gasStore.gasSpeed
  }

  get slippage(): number {
    return this.unsavedSlippage ?? this.savedSlippage
  }
}
