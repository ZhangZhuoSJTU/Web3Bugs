import { providers, Contract, BigNumber } from 'ethers'

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

export type Storage = {
  [type: string]: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [params: string]: any
  }
}
