import { Network } from 'prepo-constants'
import { providers, Contract, BigNumber } from 'ethers'
import { InitOptions } from '@web3-onboard/core'

type PromiseResolved<T> = T extends Promise<infer R> ? R : never

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContractReturn<T> = T extends (...args: any) => any
  ? PromiseResolved<ReturnType<T>> | undefined
  : never

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Abi = any[]

export type Factory = {
  connect: (
    address: string,
    provider: providers.FallbackProvider | providers.JsonRpcSigner
  ) => Contract
  abi: Abi
}

export type TransactionReceipt = {
  to: string
  from: string
  contractAddress: string
  transactionIndex: number
  root?: string
  gasUsed: BigNumber
  logsBloom: string
  blockHash: string
  transactionHash: string
  blockNumber: number
  confirmations: number
  cumulativeGasUsed: BigNumber
  effectiveGasPrice: BigNumber
  byzantium: boolean
  type: number
  status?: number
}

// this will be called to format, capture and return error within stores
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CaptureError = (error: any) => Error

// this refers to the capture function passed from application level
export type ErrorCapturer = (error: Error) => unknown

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Storage<Data = any> = {
  [type: string]: {
    [params: string]: Data
  }
}

// Config that will be sent to the Store
export type StoreConfig<SupportedContracts> = {
  appName: string
  defaultNetwork: Network
  supportedNetworks: Network[]
  onboardConfig?: InitOptions
  supportedContracts: SupportedContracts
}

export type ToastConfig = {
  message: string
  description?: string
}

export type Toast = {
  error: (config: ToastConfig) => unknown
  success: (config: ToastConfig) => unknown
  warning: (config: ToastConfig) => unknown
}

export type RootStoreOptions<TSupportedContracts> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast: Toast
  /* this will be called whenever an error happens within stores. capture errors here */
  errorCapturer?: ErrorCapturer
  storeConfig: StoreConfig<TSupportedContracts>
}
