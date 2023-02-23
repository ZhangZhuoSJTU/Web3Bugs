import { ContractStore, Factory } from 'prepo-stores'
import { makeError } from 'prepo-utils'
import { makeObservable, observable } from 'mobx'
import { RootStore } from './RootStore'
import { UniswapRouterAbi__factory, UniswapRouterAbi } from '../../generated/typechain'
import { SupportedContracts } from '../lib/contract.types'

export type ExactInput = UniswapRouterAbi['functions']['exactInput']
type ExactOutput = UniswapRouterAbi['functions']['exactOutput']

type HashCallback = (hash: string) => unknown
type Options = {
  onComplete?: () => unknown
  onError?: (error: Error) => unknown
  onHash?: HashCallback
}
export class UniswapRouterStore extends ContractStore<RootStore, SupportedContracts> {
  constructor(root: RootStore) {
    super(root, 'UNISWAP_SWAP_ROUTER', UniswapRouterAbi__factory as unknown as Factory)
    makeObservable(this, {
      exactInput: observable,
    })
  }

  async exactInput(params: Parameters<ExactInput>, options?: Options): Promise<void> {
    try {
      const { hash, wait } = await this.sendTransaction<ExactInput>('exactInput', params)
      if (options?.onHash) options.onHash(hash)
      await wait()
      if (options?.onComplete) options.onComplete()
    } catch (error) {
      if (options?.onError) {
        options.onError(makeError(error))
      } else {
        throw makeError(error)
      }
    }
  }

  async exactOutput(params: Parameters<ExactOutput>, options?: Options): Promise<void> {
    try {
      const { hash, wait } = await this.sendTransaction<ExactOutput>('exactOutput', params)
      if (options?.onHash) options.onHash(hash)
      await wait()
      if (options?.onComplete) options.onComplete()
    } catch (error) {
      if (options?.onError) {
        options.onError(makeError(error))
      } else {
        throw makeError(error)
      }
    }
  }
}
