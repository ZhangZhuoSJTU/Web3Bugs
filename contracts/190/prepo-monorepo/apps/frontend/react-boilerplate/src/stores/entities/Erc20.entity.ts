import { makeObservable, observable, runInAction, computed, action } from 'mobx'
import { BigNumber, utils } from 'ethers'
import { ContractReturn, ContractStore, Factory } from 'prepo-stores'
import { RootStore } from '../RootStore'
import { SupportedContracts, SupportedContractsNames } from '../../lib/contract.types'
import { Erc20Abi, Erc20Abi__factory } from '../../../generated/typechain'
import { balanceToNumber } from '../../utils/number-utils'

type TokenSymbol = Erc20Abi['functions']['symbol']
type BalanceOf = Erc20Abi['functions']['balanceOf']
type Decimals = Erc20Abi['functions']['decimals']
type Allowance = Erc20Abi['functions']['allowance']
type Approve = Erc20Abi['functions']['approve']
type Transfer = Erc20Abi['functions']['transfer']

export class Erc20Store extends ContractStore<RootStore, SupportedContracts> {
  approving = false
  checkingForAllowance = true
  symbolOverride?: string
  transferHash: string | undefined
  transferring = false

  constructor(
    root: RootStore,
    tokenName: SupportedContractsNames,
    storeKey: keyof RootStore,
    symbolOverride?: string
  ) {
    super(root, tokenName, Erc20Abi__factory as unknown as Factory)
    if (symbolOverride) this.symbolOverride = symbolOverride
    makeObservable(this, {
      allowance: observable,
      approve: action.bound,
      approving: observable,
      balanceOf: observable,
      balanceOfSigner: computed,
      checkingForAllowance: observable,
      decimals: observable,
      decimalsNumber: computed,
      formattedSignerBalance: computed,
      needsToAllowTokens: observable,
      signerAllowance: observable,
      signerNeedsMoreTokens: observable,
      symbol: observable,
      transfer: action.bound,
      transferHash: observable,
      transferring: observable,
    })
  }

  // contract read methods

  allowance(...params: Parameters<Allowance>): ContractReturn<Allowance> {
    return this.call<Allowance>('allowance', params)
  }

  balanceOf(...params: Parameters<BalanceOf>): ContractReturn<BalanceOf> {
    return this.call<BalanceOf>('balanceOf', params)
  }

  decimals(): ContractReturn<Decimals> {
    return this.call<Decimals>('decimals', [], { subscribe: false })
  }

  symbol(): ContractReturn<TokenSymbol> {
    return this.call<TokenSymbol>('symbol', [], { subscribe: false })
  }

  // contract write methods

  async approve(...params: Parameters<Approve>): Promise<void> {
    try {
      this.approving = true
      const { wait } = await this.sendTransaction<Approve>('approve', params)
      await wait()
    } catch (e: unknown) {
      this.root.toastStore.errorToast('Approval error', new Error((e as Error).message))
    } finally {
      runInAction(() => {
        this.approving = false
      })
    }
  }

  async transfer(...params: Parameters<Transfer>): Promise<boolean> {
    try {
      this.transferring = true
      this.transferHash = undefined
      const { hash, wait } = await this.sendTransaction<Transfer>('transfer', params)
      runInAction(() => {
        this.transferHash = hash
      })
      await wait()
      return true
    } catch (error) {
      this.root.toastStore.errorToast(`Error calling transfer`, error)
      return false
    } finally {
      runInAction(() => {
        this.transferring = false
      })
    }
  }

  get balanceOfSigner(): BigNumber | undefined {
    const { address } = this.root.web3Store.signerState
    if (!address) return undefined
    const balanceRes = this.balanceOf(address)
    if (balanceRes === undefined) return undefined
    const [balance] = balanceRes
    return balance
  }

  get decimalsNumber(): number | undefined {
    const { address } = this.root.web3Store.signerState
    if (!address) return undefined
    const decimalsRes = this.decimals()
    if (decimalsRes === undefined) return undefined
    const [decimals] = decimalsRes
    return decimals
  }

  get decimalsString(): string | undefined {
    const decimalsRes = this.decimals()
    if (decimalsRes === undefined) return undefined
    const [decimals] = decimalsRes
    return decimals.toString()
  }

  get formattedSignerBalance(): string | undefined {
    const { address } = this.root.web3Store.signerState
    if (!address) return undefined
    const decimalsRes = this.decimals()
    const balanceRes = this.balanceOf(address)
    if (decimalsRes === undefined || balanceRes === undefined) return undefined
    const [decimals] = decimalsRes
    const [balance] = balanceRes
    return utils.formatUnits(balance, decimals)
  }

  get symbolString(): string | undefined {
    const symbolRes = this.symbol()
    if (symbolRes === undefined) return undefined
    return symbolRes[0]
  }

  // we should return undefined when data is not available
  // so we can at least handle loading state instead of showing 0
  // which can be inaccurate information
  get tokenBalance(): number | undefined {
    return this.balanceOfSigner ? balanceToNumber(this.balanceOfSigner) : undefined
  }

  needsToAllowTokens(
    address: string | undefined,
    amount: BigNumber | undefined
  ): boolean | undefined {
    if (!amount) return undefined
    if (!address) return undefined
    const allowance = this.signerAllowance(address)
    if (allowance === undefined || amount === undefined) return undefined
    return allowance.lt(amount)
  }

  signerAllowance(spenderAddress: string): BigNumber | undefined {
    this.checkingForAllowance = true
    const { address: signerAddress } = this.root.web3Store.signerState
    if (!signerAddress) return undefined
    const allowanceRes = this.allowance(signerAddress, spenderAddress)
    if (allowanceRes === undefined) return undefined
    const [allowance] = allowanceRes
    this.checkingForAllowance = false
    return allowance
  }

  signerNeedsMoreTokens(amount: BigNumber | undefined): boolean | undefined {
    if (!amount) return undefined
    if (!this.balanceOfSigner) return undefined
    return this.balanceOfSigner?.lt(amount)
  }
}
