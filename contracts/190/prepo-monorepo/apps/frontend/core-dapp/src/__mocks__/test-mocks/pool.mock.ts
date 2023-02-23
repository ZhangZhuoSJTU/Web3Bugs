import { BigNumber } from 'ethers'
import { Pool } from '../../stores/entities/UniswapPoolEntity'

export const poolMock: Pool = {
  immutables: {
    factory: 'factory',
    token0: 'token0',
    token1: 'token1',
    fee: 0,
    tickSpacing: 0,
    maxLiquidityPerTick: BigNumber.from(0),
  },
  state: {
    liquidity: BigNumber.from(0),
    sqrtPriceX96: BigNumber.from(0),
    tick: 0,
    observationIndex: 0,
    observationCardinality: 0,
    observationCardinalityNext: 0,
    feeProtocol: 0,
    unlocked: false,
    currentPriceFormat: 0,
  },
}
