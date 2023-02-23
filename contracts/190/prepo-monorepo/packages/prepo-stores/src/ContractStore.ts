import { ContractCallContext } from 'ethereum-multicall'
import { action, autorun, makeObservable, observable, onBecomeUnobserved, runInAction } from 'mobx'
import { Contract, ContractFunction, BigNumber, UnsignedTransaction } from 'ethers'
import { getContractAddress } from 'prepo-utils'
import { RootStore } from './RootStore'
import { isImportantError } from './utils/error-capturer-util'
import { Abi, ContractReturn, Factory, Storage, TransactionReceipt } from './utils/stores.types'
import { DYNAMIC_CONTRACT_ADDRESS } from './utils/constants'
import { SendTransactionReturn } from './types'

type CallOptions = {
  subscribe: boolean
}

type SendTransactionOptions = {
  minimumGasLimit?: BigNumber
} & UnsignedTransaction

type GasOptions = { gasLimit?: BigNumber; gasPrice?: BigNumber }

export class ContractStore<RootStoreType, SupportedContracts> {
  contractName: keyof SupportedContracts
  address?: string
  root: RootStore<SupportedContracts> & RootStoreType
  contract?: Contract
  abi: Abi
  factory: Factory
  storage: Storage
  called: Storage

  constructor(
    root: RootStore<SupportedContracts> & RootStoreType,
    /* make sure contractName is unique across application or multicall will be confused */
    contractName: keyof SupportedContracts,
    factory: Factory
  ) {
    this.root = root
    this.contract = undefined
    this.contractName = contractName
    this.factory = factory
    this.abi = factory.abi
    this.storage = {}
    this.called = {}
    makeObservable(this, {
      storage: observable,
      init: action,
      call: observable,
      contract: observable,
      sendTransaction: observable,
      getWriteContract: action,
      generateGasOptions: action,
    })
    this.init()
  }

  init(): void {
    autorun(() => {
      const network = this.root.web3Store.network.name
      const address = getContractAddress<SupportedContracts>(
        this.contractName,
        network,
        this.root.config.supportedContracts
      )
      if (address === DYNAMIC_CONTRACT_ADDRESS) return
      if (typeof address === 'undefined')
        throw Error(`no address for ${this.contractName as string} on ${network}`)
      this.address = address
      this.contract = this.factory.connect(this.address, this.root.web3Store.coreProvider)
    })
  }

  // for initializing contract stores which address could be retrieved dynamically
  updateAddress(newAddress: string): void {
    if (newAddress !== this.contract?.address) {
      runInAction(() => {
        this.address = newAddress
        this.contract = this.factory.connect(this.address, this.root.web3Store.coreProvider)
      })
    }
  }

  async sendTransaction<T extends ContractFunction>(
    methodName: string,
    params: Parameters<T>,
    callerOptions: SendTransactionOptions = {}
  ): Promise<SendTransactionReturn> {
    // Separate custom options
    const { minimumGasLimit, ...unsignedTransaction } = callerOptions

    // Estimate gasLimit and build tx options
    const gasOptions = await this.generateGasOptions(methodName, params, unsignedTransaction)

    // Make sure gasLimit is never lower than minimumGasLimit
    if (
      minimumGasLimit !== undefined &&
      (!gasOptions.gasLimit || gasOptions.gasLimit.lt(minimumGasLimit))
    ) {
      gasOptions.gasLimit = minimumGasLimit
    }

    const options = { ...gasOptions, ...unsignedTransaction }

    // Craft and send the tx with the signer
    await this.root.web3Store.checkSigner()
    const writeContract = this.getWriteContract()
    try {
      const { hash } = await writeContract[methodName](...params, options)

      // Wait for tx to resolve with the coreProvider (signer can be seconds slower than coreProvider)
      return { hash, wait: (): Promise<TransactionReceipt> => this.root.web3Store.wait(hash) }
    } catch (error) {
      throw this.root.captureError(error)
    }
  }

  getWriteContract(): Contract {
    if (!this.contract || !this.root.web3Store.signer || !this.address)
      throw Error('contract not initialized or no signer')
    return this.factory.connect(this.address, this.root.web3Store.signer)
  }

  async generateGasOptions<T extends ContractFunction>(
    methodName: string,
    params: Parameters<T>,
    callerOptions: UnsignedTransaction = {}
  ): Promise<GasOptions> {
    if (!this.contract) throw Error('contract not initialzied')

    const estimateOptions = { from: this.root.web3Store.signerState.address, ...callerOptions }
    const options: GasOptions = {
      gasPrice: this.root.gasStore.gasPrice,
    }

    try {
      const gasLimitEstimate = await this.contract.estimateGas[methodName](
        ...params,
        estimateOptions
      )
      options.gasLimit = gasLimitEstimate.mul(2)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Gas estimation failed.')
    }
    return options
  }

  call<T extends ContractFunction>(
    methodName: string,
    params: Parameters<T>,
    options: CallOptions = { subscribe: true }
  ): ContractReturn<T> | undefined {
    try {
      const paramStr = JSON.stringify(params)

      // Init storageProperty if required
      runInAction(() => {
        if (!this.storage[methodName]) this.storage[methodName] = {}
      })

      // If cached, return cached
      const cur = this.storage[methodName][paramStr]
      if (cur !== undefined) return cur

      // Logic to execute after we get the initial value
      const onFirstSet = (res: ContractReturn<T>): void => {
        runInAction(() => {
          // Set the value
          this.storage[methodName][paramStr] = res

          if (options.subscribe) {
            // Automatically get updates for this value with the multicall,
            // and set up removing the call when this call becomes unobserved
            if (!this.address)
              throw Error(`contract ${this.contractName as string} not initialized`)
            const call: ContractCallContext = {
              reference: this.contractName as string,
              contractAddress: this.address,
              abi: this.abi,
              calls: [{ reference: methodName, methodName, methodParameters: params }],
              context: {
                contractStore: this,
              },
            }
            this.root.multicallStore.addCall(call)
            onBecomeUnobserved(this.storage[methodName], paramStr, () => {
              runInAction(() => {
                this.root.multicallStore.removeCall(call)
                delete this.storage[methodName][paramStr]
                delete this.called[methodName][paramStr]
              })
            })
          }
        })
      }

      if (this.contract) {
        // Make first call to SC to get the value
        runInAction((): void => {
          if (this.called[methodName] === undefined) this.called[methodName] = {}
          // only make call if method and it's set of params hasn't been cached
          // this is because mobx will instantly trigger calls with undefined values when something is changed
          // for example, if we try to send 100 calls and one of them returns faster than the other
          // the other 99 would still be in undefined state, hence not having this called check will cause these calls
          // that have been called to be called again
          if (!this.called[methodName][paramStr]) {
            // instantly cache a function before it's called to avoid redundant call
            this.called[methodName][paramStr] = true
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.contract.functions[methodName](...params)
              .then(onFirstSet)
              .catch((error) => {
                if (isImportantError(error)) throw this.root.captureError(error)
              })
          }
        })
      }
      return undefined
    } catch (error) {
      throw this.root.captureError(error)
    }
  }
}
