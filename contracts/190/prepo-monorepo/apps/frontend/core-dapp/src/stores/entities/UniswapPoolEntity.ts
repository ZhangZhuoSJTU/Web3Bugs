/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, makeObservable, observable } from 'mobx'
import { BigNumber, ethers } from 'ethers'
import { ContractReturn, ContractStore, Factory as prepoFactory } from 'prepo-stores'
import { RootStore } from '../RootStore'
import { SupportedContracts } from '../../lib/contract.types'
import { SupportedMarketPools } from '../../lib/markets-pool-contracts'
import { UniswapV3PoolAbi, UniswapV3PoolAbi__factory } from '../../../generated/typechain'
import { NormalizedTokenPairWithPriceOnly } from '../../types/market.types'

type Immutables = {
  factory: string
  token0: string
  token1: string
  fee: number
  tickSpacing: number
  maxLiquidityPerTick: ethers.BigNumber
}

type State = {
  liquidity: ethers.BigNumber
  sqrtPriceX96: ethers.BigNumber
  tick: number
  observationIndex: number
  observationCardinality: number
  observationCardinalityNext: number
  feeProtocol: number
  unlocked: boolean
  currentPriceFormat: number
}

export type Pool = {
  immutables: Immutables
  state: State
}

const getCurrentPrice = (sqrtPriceX96: BigNumber): number =>
  // Adding ts-ignore because of typescript complaining that BigNumber cannot be multiplied.
  // According to Typescript, only any, number or bigInt. But it doesn't recognize BigNumber.
  // This is still safe to do. So it's a false/positive from Typescript
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  sqrtPriceX96 ** 2 / 2 ** 192

type Factory = UniswapV3PoolAbi['functions']['factory']
type Token0 = UniswapV3PoolAbi['functions']['token0']
type Token1 = UniswapV3PoolAbi['functions']['token1']
type Fee = UniswapV3PoolAbi['functions']['fee']
type TickSpacing = UniswapV3PoolAbi['functions']['tickSpacing']
type MaxLiquidityPerTick = UniswapV3PoolAbi['functions']['maxLiquidityPerTick']

type Liquidity = UniswapV3PoolAbi['functions']['liquidity']
type Slot0 = UniswapV3PoolAbi['functions']['slot0']

export class UniswapPoolEntity extends ContractStore<RootStore, SupportedContracts> {
  poolContract: ethers.Contract | undefined

  constructor(root: RootStore, poolAddressKey: SupportedMarketPools) {
    super(root, poolAddressKey, UniswapV3PoolAbi__factory as unknown as prepoFactory)
    makeObservable(this, {
      factoryCall: observable,
      token0: observable,
      token1: observable,
      fee: observable,
      tickSpacing: observable,
      maxLiquidityPerTick: observable,
      liquidity: observable,
      slot0: observable,
      pool: computed,
      poolImmutables: computed,
      poolState: computed,
    })
  }

  factoryCall(): ContractReturn<Factory> {
    return this.call<Factory>('factory', [], { subscribe: false })
  }

  token0(): ContractReturn<Token0> {
    return this.call<Token0>('token0', [], { subscribe: false })
  }

  token1(): ContractReturn<Token1> {
    return this.call<Token1>('token1', [], { subscribe: false })
  }

  fee(): ContractReturn<Fee> {
    return this.call<Fee>('fee', [], { subscribe: false })
  }

  tickSpacing(): ContractReturn<TickSpacing> {
    return this.call<TickSpacing>('tickSpacing', [], { subscribe: false })
  }

  maxLiquidityPerTick(): ContractReturn<MaxLiquidityPerTick> {
    return this.call<MaxLiquidityPerTick>('maxLiquidityPerTick', [], { subscribe: false })
  }

  liquidity(): ContractReturn<Liquidity> {
    return this.call<Liquidity>('liquidity', [], { subscribe: false })
  }

  slot0(): ContractReturn<Slot0> {
    return this.call<Slot0>('slot0', [])
  }

  get pool(): Pool | undefined {
    const immutables = this.poolImmutables
    const state = this.poolState
    if (immutables === undefined || state === undefined) return undefined

    return { immutables, state }
  }

  get poolPriceData(): NormalizedTokenPairWithPriceOnly | undefined {
    if (this.pool === undefined) return undefined
    const { immutables, state } = this.pool
    if (immutables === undefined || state === undefined) return undefined
    return {
      token0: {
        id: immutables.token0,
        price: 1 / state.currentPriceFormat,
      },
      token1: {
        id: immutables.token1,
        price: state.currentPriceFormat,
      },
    }
  }

  get poolImmutables(): Immutables | undefined {
    const factoryRes = this.factoryCall()
    const token0Res = this.token0()
    const token1Res = this.token1()
    const feeRes = this.fee()
    const tickSpacingRes = this.tickSpacing()
    const maxLiquidityPerTickRes = this.maxLiquidityPerTick()
    if (
      factoryRes === undefined ||
      token0Res === undefined ||
      token1Res === undefined ||
      feeRes === undefined ||
      tickSpacingRes === undefined ||
      maxLiquidityPerTickRes === undefined
    )
      return undefined
    const [factory] = factoryRes
    const [token0] = token0Res
    const [token1] = token1Res
    const [fee] = feeRes
    const [tickSpacing] = tickSpacingRes
    const [maxLiquidityPerTick] = maxLiquidityPerTickRes

    return {
      factory,
      token0,
      token1,
      fee,
      tickSpacing,
      maxLiquidityPerTick,
    }
  }

  get poolState(): State | undefined {
    const liquidityRes = this.liquidity()
    const slot = this.slot0()
    if (liquidityRes === undefined || slot === undefined) return undefined
    const [liquidity] = liquidityRes

    return {
      liquidity,
      sqrtPriceX96: slot[0],
      tick: slot[1],
      observationIndex: slot[2],
      observationCardinality: slot[3],
      observationCardinalityNext: slot[4],
      feeProtocol: slot[5],
      unlocked: slot[6],
      currentPriceFormat: getCurrentPrice(slot[0]),
    }
  }
}
