/* eslint-disable @typescript-eslint/no-shadow */
import Pool from '../pool'
import Actor from '../actor'
import { DELTA, INITIAL_LP_SUPPLY } from '../../constants'

const initialStable = 500
const initialMarket = 1000

const creator = new Actor('pool-creator', Number.MAX_SAFE_INTEGER)
const fee = 0.02
const bounds = { ceil: 0.8, floor: 0.2 }
let pool: Pool

describe('a pool is initialized', () => {
  beforeEach(() => {
    pool = new Pool(creator, { fee, bounds }, { stable: initialStable, market: initialMarket })
  })

  // check initialization logic
  test('the creator is allocated a correct number of lp tokens', () => {
    const creatorBalance = pool.getLpTokenBalance(creator)
    expect(creatorBalance).toEqual(INITIAL_LP_SUPPLY)
  })

  test('initial lpTokenSupply is set correctly', () => {
    expect(pool.lpTokenSupply).toEqual(INITIAL_LP_SUPPLY)
  })

  test('initial realReserves is set correctly', () => {
    expect(pool.realReserves).toEqual({
      stable: initialStable,
      market: initialMarket,
    })
  })

  test('initial fees are set correctly', () => {
    expect(pool.accumulatedFees).toEqual({ market: 0, stable: 0 })
  })

  test('virtualLiquidity is set correctly', () => {
    // See Initialisation
    // https://www.notion.so/Concentrated-Liquidity-SDK-Implementation-362d04ed1b724be2a77c1701bcbc41ed
    expect(pool.virtualLiquidity ** 2).toEqual(
      (pool.realReserves.market + pool.virtualLiquidity / Math.sqrt(bounds.ceil)) *
        (pool.realReserves.stable + pool.virtualLiquidity * Math.sqrt(bounds.floor))
    )
    const virtualReserves = Pool.calcVirtualReserves(pool)
    expect(pool.virtualLiquidity).toEqual(
      Math.sqrt(virtualReserves.market * virtualReserves.stable)
    )
    // L = sqrt(x*y)
    expect(pool.virtualLiquidity).toEqual(
      Math.sqrt(virtualReserves.market * virtualReserves.stable)
    )
    // L = y / sqrt(P)
    expect(pool.virtualLiquidity).toEqual(virtualReserves.stable / pool.sqrtPrice)
    // L = x * sqrt(P)
    expect(pool.virtualLiquidity.toFixed(10)).toEqual(
      (virtualReserves.market * pool.sqrtPrice).toFixed(10)
    )
  })

  test('sqrtPrice is set correctly', () => {
    // See Initialisation
    // https://www.notion.so/Concentrated-Liquidity-SDK-Implementation-362d04ed1b724be2a77c1701bcbc41ed
    // virtualLiquidity = y + L * sqrt(pa)) / L
    expect(pool.sqrtPrice).toEqual(
      (initialStable + pool.virtualLiquidity * Math.sqrt(pool.config.bounds.floor)) /
        pool.virtualLiquidity
    )
    // x = virtualLiquidity((sqrt(pb) - sqrt(P)) / (sqrt(P) * sqrt(pb)))
    const x =
      pool.virtualLiquidity *
      ((Math.sqrt(pool.config.bounds.ceil) - pool.sqrtPrice) /
        (pool.sqrtPrice * Math.sqrt(pool.config.bounds.ceil)))
    expect(x.toFixed(10)).toEqual(initialMarket.toFixed(10))
  })

  // check trade logic
  describe('a trader swaps some tokens', () => {
    const traderInAmount = 1440.45
    let out: number
    let sqrtPriceBefore: number
    let sqrtInversePriceBefore: number
    let sqrtPriceAfter: number
    let sqrtInversePriceAfter: number
    let sqrtPriceDelta: number
    let sqrtInversePriceDelta: number
    beforeEach(() => {
      sqrtPriceBefore = pool.sqrtPrice
      sqrtInversePriceBefore = 1 / sqrtPriceBefore
      out = pool.swapExactTokensForTokens('market', traderInAmount)
      sqrtPriceAfter = pool.sqrtPrice
      sqrtInversePriceAfter = 1 / sqrtPriceAfter
    })

    test('sqrtPrice changes the expected amount', () => {
      // See Swaps
      // https://www.notion.so/Concentrated-Liquidity-SDK-Implementation-362d04ed1b724be2a77c1701bcbc41ed
      sqrtInversePriceDelta = (traderInAmount * (1 - pool.config.fee)) / pool.virtualLiquidity
      sqrtInversePriceAfter = sqrtInversePriceBefore + sqrtInversePriceDelta
      sqrtPriceAfter = 1 / sqrtInversePriceAfter
      sqrtPriceDelta = sqrtPriceAfter - sqrtPriceBefore
      expect(pool.sqrtPrice).toEqual(sqrtPriceAfter)
    })

    test('the pool gives out the expected number of tokens', () => {
      // See Swaps
      // https://www.notion.so/Concentrated-Liquidity-SDK-Implementation-362d04ed1b724be2a77c1701bcbc41ed
      const expectedOut = (sqrtPriceAfter - sqrtPriceBefore) * pool.virtualLiquidity
      expect(-out).toEqual(expectedOut)
    })

    test('virtualLiquidity formula holds', () => {
      // See Initialisation
      // https://www.notion.so/Concentrated-Liquidity-SDK-Implementation-362d04ed1b724be2a77c1701bcbc41ed
      const virtualReserves = Pool.calcVirtualReserves(pool)
      // L = sqrt(x*y)
      expect(pool.virtualLiquidity).toEqual(
        Math.sqrt(virtualReserves.market * virtualReserves.stable)
      )
      // L = y / sqrt(P)
      expect(pool.virtualLiquidity).toEqual(virtualReserves.stable / pool.sqrtPrice)
      // L = x * sqrt(P)
      expect(pool.virtualLiquidity.toFixed(10)).toEqual(
        (virtualReserves.market * pool.sqrtPrice).toFixed(10)
      )
      // L = delta(y) / delta(sqrt(P))
      expect(pool.virtualLiquidity).toEqual(-out / sqrtPriceDelta)
      // L = delta(x) / delta(1/sqrt(P))
      expect(pool.virtualLiquidity).toEqual((traderInAmount * (1 - fee)) / sqrtInversePriceDelta)

      // L calculation from realReserves & bounds
      expect((pool.virtualLiquidity ** 2).toFixed(5)).toEqual(
        (
          (pool.realReserves.market + pool.virtualLiquidity / Math.sqrt(bounds.ceil)) *
          (pool.realReserves.stable + pool.virtualLiquidity * Math.sqrt(bounds.floor))
        ).toFixed(5)
      )
    })

    test('accumulatedFees are updated correctly', () => {
      expect(pool.accumulatedFees).toEqual({
        market: traderInAmount * fee,
        stable: 0,
      })
    })

    test('sqrtPrice is set correctly', () => {
      const virtualReserves = Pool.calcVirtualReserves(pool)
      expect(pool.sqrtPrice).toEqual(Math.sqrt(virtualReserves.stable / virtualReserves.market))
    })
  })
})

test('Pool.calcVirtualLiquidity gives expected results', () => {
  const stable = 1000
  const market = 1000
  const poolNoConcLiq = new Pool(
    creator,
    { fee, bounds: { ceil: Number.MAX_SAFE_INTEGER, floor: 0 } },
    { stable, market }
  )
  const noConcentratedLiquidity = Pool.calcVirtualLiquidity(poolNoConcLiq)
  // Without concentrated liquidity, L = sqrt(x*y)
  expect(Math.round(noConcentratedLiquidity)).toEqual(Math.round(Math.sqrt(stable * market)))

  const poolConcLiq = new Pool(
    creator,
    { fee, bounds: { ceil: 0.8, floor: 0.2 } },
    { stable, market }
  )
  // With concentrated liquidity between 0.2, 0.8, liquidity is increased
  // about 3.6x
  const concentratedLiquidity = Pool.calcVirtualLiquidity(poolConcLiq)
  expect(concentratedLiquidity).toEqual(3674.7498952227515)
})

test('Pool.amountOutGivenIn gives expected results', () => {
  const creator = new Actor('test', Number.MAX_SAFE_INTEGER)
  const pool = new Pool(
    creator,
    { fee, bounds: { ceil: 0.8, floor: 0.2 } },
    { stable: initialStable, market: initialMarket }
  )
  const stableInRes = Pool.amountOutGivenIn('stable', 100, pool.virtualLiquidity, pool.sqrtPrice)
  expect(stableInRes).toEqual({
    amountOut: 220.3163483587481,
    sqrtPriceDelta: 0.041239550603620535,
  })

  const marketInRes = Pool.amountOutGivenIn('market', 50, pool.virtualLiquidity, pool.sqrtPrice)
  expect(marketInRes).toEqual({
    sqrtPriceDelta: -0.008686503675883639,
    amountOut: 21.06352651457125,
  })
})

test('Pool.amountInGivenOut gives expected results', () => {
  const creator = new Actor('test', Number.MAX_SAFE_INTEGER)
  const pool = new Pool(
    creator,
    { fee, bounds: { ceil: 0.8, floor: 0.2 } },
    { stable: initialStable, market: initialMarket }
  )
  const stableInRes = Pool.amountInGivenOut('stable', 100, pool.virtualLiquidity, pool.sqrtPrice)
  expect(stableInRes).toEqual({
    amountIn: 249.9999999999998,
    sqrtPriceDelta: -0.041239550603620535,
  })

  const marketInRes = Pool.amountInGivenOut('market', 50, pool.virtualLiquidity, pool.sqrtPrice)
  expect(marketInRes).toEqual({
    sqrtPriceDelta: 0.008923770334911652,
    amountIn: 21.63886415902944,
  })
})

test('Pool functions correctly trading around upper and lower bounds', () => {
  const creator = new Actor('test', Number.MAX_SAFE_INTEGER)
  const bounds = { ceil: 0.8, floor: 0.2 }
  const pool = new Pool(
    creator,
    { fee: 0, bounds },
    { stable: initialStable, market: initialMarket }
  )

  const upperTarget = bounds.ceil
  const lowerTarget = bounds.floor
  const tradeSizeToUpperTarget = Pool.calcMarketTradeSizeToTargetPrice(
    pool.virtualLiquidity,
    pool.sqrtPrice,
    upperTarget
  )
  pool.swapTokensForExactTokens('market', tradeSizeToUpperTarget, Number.MAX_SAFE_INTEGER)
  // Price must be at upper target
  expect(Math.abs(Pool.calcMarketTokenPrice(pool) - upperTarget) < DELTA).toEqual(true)
  // Market real reserves must be depleted
  expect(Math.abs(pool.realReserves.market) < DELTA).toEqual(true)

  const tradeSizeToLowerTarget = Pool.calcMarketTradeSizeToTargetPrice(
    pool.virtualLiquidity,
    pool.sqrtPrice,
    lowerTarget
  )
  pool.swapTokensForExactTokens('market', tradeSizeToLowerTarget, Number.MAX_SAFE_INTEGER)

  // Price must be at lower target
  expect(Math.abs(Pool.calcMarketTokenPrice(pool) - lowerTarget) < DELTA).toEqual(true)
  // Stable real reserves must be depleted
  expect(Math.abs(pool.realReserves.stable) < DELTA).toEqual(true)
})
