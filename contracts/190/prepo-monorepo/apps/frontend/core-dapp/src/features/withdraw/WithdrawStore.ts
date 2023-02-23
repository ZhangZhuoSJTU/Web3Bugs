import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { makeAutoObservable } from 'mobx'
import { validateStringToBN } from 'prepo-utils'
import { RootStore } from '../../stores/RootStore'

export class WithdrawStore {
  donationPercentage: number
  withdrawalAmount = ''

  constructor(public root: RootStore) {
    this.donationPercentage = 0
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setDonationPercentage(percentage: number): void {
    this.donationPercentage = percentage
  }

  setWithdrawalAmount(amount: string): void {
    if (validateStringToBN(amount, this.root.preCTTokenStore.decimalsNumber))
      this.withdrawalAmount = amount
  }

  // eslint-disable-next-line require-await
  async withdraw(): Promise<{
    success: boolean
    error?: string | undefined
  }> {
    const { preCTTokenStore } = this.root
    return this.withdrawalAmountBN !== undefined && this.withdrawalAmountBN.gt(0)
      ? preCTTokenStore.withdraw(this.withdrawalAmountBN)
      : { success: false }
  }

  get amountForSharesBN(): BigNumber | undefined {
    if (this.sharesForAmountBN === undefined) return undefined
    const amountForShares = this.root.preCTTokenStore.getAmountForShares(this.sharesForAmountBN)
    return amountForShares?.[0]
  }

  get donationAmount(): number {
    return (+this.withdrawalAmount * this.donationPercentage) / 100
  }

  get sharesForAmountBN(): BigNumber | undefined {
    if (this.withdrawalAmountBN === undefined) return undefined
    const sharesForAmount = this.root.preCTTokenStore.getSharesForAmount(this.withdrawalAmountBN)
    return sharesForAmount?.[0]
  }

  get withdrawalAmountBN(): BigNumber | undefined {
    return this.root.preCTTokenStore.parseUnits(this.withdrawalAmount)
  }

  get withdrawalDisabled(): boolean {
    const { tokenBalanceRaw } = this.root.preCTTokenStore
    return (
      tokenBalanceRaw === undefined ||
      !this.withdrawalAmountBN ||
      this.withdrawalAmountBN.lte(0) ||
      this.withdrawalAmountBN.gt(tokenBalanceRaw)
    )
  }

  get withdrawalFees(): BigNumber {
    const { redemptionFee, feeDenominator } = this.root.preCTTokenStore
    if (this.withdrawalAmountBN === undefined || feeDenominator === undefined)
      return BigNumber.from(0)
    return this.withdrawalAmountBN.mul(redemptionFee || 0).div(feeDenominator)
  }

  get withdrawalReceivedAmount(): string | undefined {
    const { preCTTokenStore } = this.root
    if (this.sharesForAmountBN === undefined || this.amountForSharesBN === undefined)
      return undefined
    const donationAmountBigNumber = parseEther(`${this.donationAmount}`)
    const amountBeforeFee = this.amountForSharesBN.sub(donationAmountBigNumber)
    return preCTTokenStore.formatUnits(amountBeforeFee.sub(this.withdrawalFees))
  }

  get withdrawUILoading(): boolean {
    const { withdrawing } = this.root.preCTTokenStore
    return (
      withdrawing ||
      this.withdrawalReceivedAmount === undefined ||
      this.withdrawalAmountBN === undefined
    )
  }
}
