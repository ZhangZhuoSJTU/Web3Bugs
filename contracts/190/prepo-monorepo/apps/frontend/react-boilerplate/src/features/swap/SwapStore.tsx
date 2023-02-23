import { makeObservable, observable, action } from 'mobx'
import { RootStore } from '../../stores/RootStore'

export class SwapStore {
  root: RootStore
  usdcInputValue: string | undefined
  ethInputValue: string | undefined

  constructor(root: RootStore) {
    makeObservable(this, {
      root: observable,
      usdcInputValue: observable,
      setUsdcInputValue: action,
      ethInputValue: observable,
      setEthInputValue: action,
    })

    this.root = root
  }

  setUsdcInputValue = (newValue: string): void => {
    this.usdcInputValue = newValue
  }

  setEthInputValue = (newValue: string): void => {
    this.ethInputValue = newValue
  }
}
