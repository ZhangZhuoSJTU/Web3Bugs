import { BigNumber } from 'ethers'
import { makeAutoObservable, reaction, runInAction } from 'mobx'
import { safeStringBN } from 'prepo-utils'
import { TRANSACTION_SETTING } from '../../../lib/constants'
import { RootStore } from '../../../stores/RootStore'

export class StakeStore {
  currentStakingValue = `${TRANSACTION_SETTING.DEFAULT_AMOUNT}`
  showDelegate = true

  constructor(private root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
    this.subscribe()
  }

  get isCurrentStakingValueValid(): boolean {
    const { tokenBalanceRaw } = this.root.ppoTokenStore
    // TODO: parseEther(`${this.currentStakingValue}`) when SC
    return (
      tokenBalanceRaw !== undefined &&
      this.currentStakingValueBN !== undefined &&
      this.currentStakingValueBN.gt(0) &&
      tokenBalanceRaw.gte(this.currentStakingValueBN)
    )
  }

  get currentStakingValueBN(): BigNumber | undefined {
    return this.root.ppoTokenStore.parseUnits(safeStringBN(this.currentStakingValue))
  }

  setCurrentStakingValue(value: string): void {
    try {
      if (value === '') {
        this.currentStakingValue = ''
        return
      }
      this.root.ppoTokenStore.parseUnits(safeStringBN(value))
      this.currentStakingValue = value
    } catch (error) {
      // invalid input
    }
  }

  onDelegateShowChange(show: boolean): void {
    this.showDelegate = show
  }

  stake(): Promise<{
    success: boolean
    error?: string | undefined
  }> {
    if (!this.isCurrentStakingValueValid || this.currentStakingValueBN === undefined) {
      return Promise.resolve({ success: false })
    }
    return this.root.ppoStakingStore.stake(this.currentStakingValueBN)
  }

  private subscribe(): void {
    reaction(
      () => this.root.delegateStore.selectedDelegate,
      (delegate) => {
        runInAction(() => {
          if (!delegate) {
            this.showDelegate = false
          }
        })
      }
    )
  }
}
