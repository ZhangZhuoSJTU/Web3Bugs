import { CheckboxChangeEvent } from 'antd/lib/checkbox'
import { BigNumber } from 'ethers'
import { makeAutoObservable } from 'mobx'
import { safeStringBN } from 'prepo-utils'
import { TRANSACTION_SETTING } from '../../../lib/constants'
import { RootStore } from '../../../stores/RootStore'

const FEE_MOCK = 7.5

export class UnstakeStore {
  confirm = false
  currentUnstakingValue = `${TRANSACTION_SETTING.DEFAULT_AMOUNT}`
  fee = FEE_MOCK

  get isCurrentUnstakingValueValid(): boolean {
    const stakedPPO = this.root.ppoStakingStore.balanceData?.raw

    if (!stakedPPO) return false
    return (
      // TODO: parseEther with real SC
      stakedPPO.gte(this.currentUnstakingValue) &&
      this.currentUnstakingValueBN !== undefined &&
      this.currentUnstakingValueBN?.gt(0)
    )
  }

  constructor(private root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setConfirm({ target: { checked } }: CheckboxChangeEvent): void {
    this.confirm = checked
  }

  setCurrentUnstakingValue(value: string): void {
    try {
      if (value === '') {
        this.currentUnstakingValue = ''
        return
      }
      this.root.ppoTokenStore.parseUnits(safeStringBN(value))
      this.currentUnstakingValue = value
    } catch (error) {
      // invalid input
    }
  }

  startCooldown(): Promise<{
    success: boolean
    error?: string | undefined
  }> {
    if (!this.valid || this.currentUnstakingValueBN === undefined) {
      return Promise.resolve({ success: false })
    }
    return this.root.ppoStakingStore.startCooldown(this.currentUnstakingValueBN)
  }

  get currentUnstakingValueBN(): BigNumber | undefined {
    return this.root.ppoTokenStore.parseUnits(safeStringBN(this.currentUnstakingValue))
  }

  get valid(): boolean {
    const { balanceData } = this.root.ppoStakingStore
    return (
      balanceData !== undefined &&
      this.currentUnstakingValueBN !== undefined &&
      this.currentUnstakingValueBN.gt(0) &&
      BigNumber.from(balanceData.raw).gte(this.currentUnstakingValue)
    )
  }

  withdraw = (
    immediate: boolean
  ): Promise<{
    success: boolean
    error?: string | undefined
  }> => {
    if (!this.valid || this.currentUnstakingValueBN === undefined) {
      return Promise.resolve({ success: false })
    }
    return this.root.ppoStakingStore.withdraw(this.currentUnstakingValueBN, immediate)
  }
}
