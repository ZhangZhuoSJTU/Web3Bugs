import { action, computed, makeObservable, observable, runInAction } from 'mobx'
import { BigNumber } from 'ethers'
import { ContractReturn, Factory } from 'prepo-stores'
import { formatEther, parseEther } from 'ethers/lib/utils'
import { ChainId, Token } from '@uniswap/sdk'
import { getContractAddress } from 'prepo-utils'
import { RootStore } from './RootStore'
import { Erc20Store } from './entities/Erc20.entity'
import { getContractCall } from './utils/web3-store-utils'
import { CollateralAbi, CollateralAbi__factory } from '../../generated/typechain'
import { SupportedContracts } from '../lib/contract.types'
import { supportedContracts } from '../lib/supported-contracts'
import { numberFormatter } from '../utils/numberFormatter'

const { toUsd } = numberFormatter

type Deposit = CollateralAbi['functions']['deposit']
type GetAmountForShares = CollateralAbi['functions']['getAmountForShares']
type GetFeeDenominator = CollateralAbi['functions']['getFeeDenominator']
type GetSharesForAmount = CollateralAbi['functions']['getSharesForAmount']
type GetMintingFee = CollateralAbi['functions']['getMintingFee']
type GetRedemptionFee = CollateralAbi['functions']['getRedemptionFee']
type Withdraw = CollateralAbi['functions']['withdraw']

const TOKEN_SYMBOL = 'preCT'
const TOKEN_DECIMALS = 18

const calculateUserBalance = (preCTBalance: BigNumber, sharesForAmount: BigNumber): number =>
  +formatEther(preCTBalance) / +formatEther(sharesForAmount)
export class CollateralStore extends Erc20Store {
  depositHash?: string
  depositing = false
  withdrawHash?: string
  withdrawing = false
  uniswapToken: Token

  constructor(root: RootStore) {
    super({ root, tokenName: TOKEN_SYMBOL, factory: CollateralAbi__factory as unknown as Factory })
    const chainId = this.root.web3Store.network.chainId as unknown as ChainId
    const network = this.root.web3Store.network.name
    this.symbolOverride = TOKEN_SYMBOL
    this.uniswapToken = new Token(
      chainId,
      getContractAddress<SupportedContracts>(TOKEN_SYMBOL, network, supportedContracts) ?? '',
      TOKEN_DECIMALS,
      TOKEN_SYMBOL,
      TOKEN_SYMBOL
    )

    makeObservable(this, {
      deposit: action.bound,
      depositHash: observable,
      depositing: observable,
      getAmountForShares: observable,
      getSharesForAmount: observable,
      getMintingFee: observable,
      getRedemptionFee: observable,
      sharesForAmount: computed,
      setDepositHash: action.bound,
      setTransferHash: action.bound,
      setWithdrawHash: action.bound,
      withdraw: action.bound,
      withdrawHash: observable,
      withdrawing: observable,
    })
  }

  getAmountForShares(
    ...params: Parameters<GetAmountForShares>
  ): ContractReturn<GetAmountForShares> {
    return this.call<GetAmountForShares>('getAmountForShares', params)
  }

  getFeeDenominator(...params: Parameters<GetFeeDenominator>): ContractReturn<GetFeeDenominator> {
    return this.call<GetFeeDenominator>('getFeeDenominator', params)
  }

  getSharesForAmount(
    ...params: Parameters<GetSharesForAmount>
  ): ContractReturn<GetSharesForAmount> {
    return this.call<GetSharesForAmount>('getSharesForAmount', params)
  }

  getMintingFee(...params: Parameters<GetMintingFee>): ContractReturn<GetMintingFee> {
    return this.call<GetMintingFee>('getMintingFee', params)
  }

  getRedemptionFee(...params: Parameters<GetRedemptionFee>): ContractReturn<GetRedemptionFee> {
    return this.call<GetRedemptionFee>('getRedemptionFee', params)
  }

  async deposit(...params: Parameters<Deposit>): Promise<{ success: boolean; error?: string }> {
    try {
      this.depositing = true
      this.depositHash = undefined
      const { hash, wait } = await this.sendTransaction<Deposit>('deposit', params)
      runInAction(() => {
        this.depositHash = hash
      })
      await wait()
      return {
        success: true,
      }
    } catch (error) {
      this.root.toastStore.errorToast(`Error calling transfer`, error)
      return {
        success: false,
        error: (error as Error).message,
      }
    } finally {
      runInAction(() => {
        this.depositing = false
      })
    }
  }

  async withdraw(...params: Parameters<Withdraw>): Promise<{ success: boolean; error?: string }> {
    try {
      this.withdrawing = true
      this.withdrawHash = undefined
      const { hash, wait } = await this.sendTransaction<Withdraw>('withdraw', params)
      runInAction(() => {
        this.withdrawHash = hash
      })
      await wait()
      return {
        success: true,
      }
    } catch (error) {
      this.root.toastStore.errorToast(`Error calling withdraw`, error)
      return {
        success: false,
        error: (error as Error).message,
      }
    } finally {
      runInAction(() => {
        this.withdrawing = false
      })
    }
  }

  get feeDenominator(): BigNumber | undefined {
    const feeDenominatorRaw = this.getFeeDenominator()
    if (feeDenominatorRaw === undefined) return undefined
    return feeDenominatorRaw[0]
  }

  get sharesForAmount(): BigNumber | undefined {
    const ONE_USD = parseEther('1')
    const sharesForAmountCall = this.getSharesForAmount(ONE_USD)
    if (sharesForAmountCall === undefined) return undefined
    const [sharesForAmount] = sharesForAmountCall
    return sharesForAmount
  }

  get mintingFee(): BigNumber | undefined {
    return getContractCall(this.getMintingFee())
  }

  get redemptionFee(): BigNumber | undefined {
    return getContractCall(this.getRedemptionFee())
  }

  get signerBalance(): number {
    if (this.balanceOfSigner && this.sharesForAmount) {
      return calculateUserBalance(this.balanceOfSigner, this.sharesForAmount)
    }

    return 0
  }

  get formatSignerBalance(): string {
    return toUsd(this.signerBalance)
  }

  // setters

  setDepositHash(hash?: string): void {
    this.depositHash = hash
  }

  setTransferHash(hash?: string): void {
    this.transferHash = hash
  }

  setWithdrawHash(hash?: string): void {
    this.withdrawHash = hash
  }
}
