import { BigNumber } from 'ethers'
import { makeAutoObservable } from 'mobx'
import { validateStringToBN } from 'prepo-utils'
import { RootStore } from '../../stores/RootStore'

export class DepositStore {
  depositAmount = ''

  constructor(public root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setDepositAmount(amount: string): void {
    if (validateStringToBN(amount, this.root.baseTokenStore.decimalsNumber))
      this.depositAmount = amount
  }

  // eslint-disable-next-line require-await
  async deposit(): Promise<{
    success: boolean
    error?: string | undefined
  }> {
    if (this.depositAmount === '')
      return { success: false, error: 'Please enter an amount to deposit.' }
    const { baseTokenStore } = this.root
    const { deposit } = this.root.preCTTokenStore
    const depositAmount = baseTokenStore.parseUnits(this.depositAmount)
    if (depositAmount) return deposit(depositAmount)
    return { success: false, error: 'Invalid deposit amount' }
  }

  get depositDisabled(): boolean {
    const { tokenBalanceRaw } = this.root.baseTokenStore
    if (this.depositAmountBN && tokenBalanceRaw) return this.depositAmountBN.gt(tokenBalanceRaw)
    return false
  }

  get depositAmountBN(): BigNumber | undefined {
    if (this.depositAmount === '') return BigNumber.from(0)
    return this.root.baseTokenStore.parseUnits(this.depositAmount)
  }

  get depositFees(): string | undefined {
    const { preCTTokenStore } = this.root
    const { feeDenominator, mintingFee } = preCTTokenStore
    if (
      mintingFee === undefined ||
      this.depositAmountBN === undefined ||
      feeDenominator === undefined
    )
      return undefined
    return this.root.baseTokenStore.formatUnits(
      this.depositAmountBN.mul(mintingFee).div(feeDenominator).add(1)
    )
  }

  // perfect accuracy not required since this is estimation
  get estimatedReceivedAmount(): number {
    const { sharesForAmount } = this.root.preCTTokenStore
    if (sharesForAmount === undefined || this.depositAmountBN === undefined) return 0
    return +(this.root.preCTTokenStore.formatUnits(sharesForAmount) ?? 0) * +this.depositAmount
  }
}
