import Actor from './actor'
import { DELTA, INITIAL_LP_SUPPLY } from '../constants'
import { PoolConfig, PoolBalance } from '../types'

type PoolToken = 'stable' | 'market'

export default class Pool {
  config: PoolConfig
  realReserves: PoolBalance
  accumulatedFees: PoolBalance
  lpTokenSupply: number
  lpBalances: Map<Actor, number>
  virtualLiquidity: number
  sqrtPrice: number

  static initSqrtPrice(y: number, L: number, pa: number): number {
    // https://www.notion.so/Concentrated-Liquidity-SDK-Implementation-362d04ed1b724be2a77c1701bcbc41ed
    return (y + L * Math.sqrt(pa)) / L
  }

  static calcMarketTokenPrice(pool: Pool): number {
    return pool.sqrtPrice ** 2
  }

  // In 50/50 pools total pool value is stable part * 2
  static calcPoolValue(pool: PoolBalance, marketPrice: number): number {
    return pool.stable + pool.market * marketPrice
  }

  static calcVirtualReserves(pool: Pool): PoolBalance {
    const { virtualLiquidity, sqrtPrice } = pool
    return {
      stable: virtualLiquidity * sqrtPrice,
      market: virtualLiquidity / sqrtPrice,
    }
  }

  static calcLpTokenPrice(lpTokenSupply: number, totalPoolValue: number): number {
    return totalPoolValue / lpTokenSupply
  }

  static calcMarketTradeSizeToTargetPrice(
    virtualLiquidity: number,
    curSqrtPrice: number,
    targetPrice: number
  ): number {
    const targetSqrtPriceInverse = 1 / Math.sqrt(targetPrice)
    const curSqrtPriceInverse = 1 / curSqrtPrice
    const sqrtPriceInverseDelta = targetSqrtPriceInverse - curSqrtPriceInverse
    // return number of market tokens to trade to reach target price
    return -1 * sqrtPriceInverseDelta * virtualLiquidity
  }

  static amountOutGivenIn(
    tokenIn: PoolToken,
    amountIn: number,
    virtualLiquidity: number,
    sqrtPriceBefore: number
  ): { amountOut: number; sqrtPriceDelta: number } {
    // See Swaps
    // https://www.notion.so/Concentrated-Liquidity-SDK-Implementation-362d04ed1b724be2a77c1701bcbc41ed

    const sqrtPriceInverseBefore = 1 / sqrtPriceBefore

    if (tokenIn === 'stable') {
      const sqrtPriceDelta = amountIn / virtualLiquidity
      const sqrtPriceAfter = sqrtPriceBefore + sqrtPriceDelta
      const sqrtPriceInverseAfter = 1 / sqrtPriceAfter
      const sqrtPriceInverseDelta = sqrtPriceInverseAfter - sqrtPriceInverseBefore
      const amountOut = -1 * sqrtPriceInverseDelta * virtualLiquidity
      return { sqrtPriceDelta, amountOut }
    }

    // inToken 'market'
    const sqrtPriceInverseDelta = amountIn / virtualLiquidity
    const sqrtPriceInverseAfter = sqrtPriceInverseBefore + sqrtPriceInverseDelta
    const sqrtPriceAfter = 1 / sqrtPriceInverseAfter
    const sqrtPriceDelta = sqrtPriceAfter - sqrtPriceBefore
    const amountOut = -1 * sqrtPriceDelta * virtualLiquidity
    return { sqrtPriceDelta, amountOut }
  }

  static amountInGivenOut(
    tokenOut: PoolToken,
    amountOut: number,
    virtualLiquidity: number,
    sqrtPriceBefore: number
  ): { amountIn: number; sqrtPriceDelta: number } {
    // TODO add math explainer link

    const sqrtPriceInverseBefore = 1 / sqrtPriceBefore

    if (tokenOut === 'stable') {
      const sqrtPriceDelta = (-1 * amountOut) / virtualLiquidity
      const sqrtPriceAfter = sqrtPriceBefore + sqrtPriceDelta
      const sqrtPriceInverseAfter = 1 / sqrtPriceAfter
      const sqrtPriceInverseDelta = sqrtPriceInverseAfter - sqrtPriceInverseBefore
      const amountIn = sqrtPriceInverseDelta * virtualLiquidity
      return { sqrtPriceDelta, amountIn }
    }

    // tokenOut 'market'
    const sqrtPriceInverseDelta = (-1 * amountOut) / virtualLiquidity
    const sqrtPriceInverseAfter = sqrtPriceInverseBefore + sqrtPriceInverseDelta
    const sqrtPriceAfter = 1 / sqrtPriceInverseAfter
    const sqrtPriceDelta = sqrtPriceAfter - sqrtPriceBefore
    const amountIn = sqrtPriceDelta * virtualLiquidity
    return { sqrtPriceDelta, amountIn }
  }

  /**
   * How many LP tokens to mint for the protocol on a successful trade?
   */
  static calcProtocolFee(
    valueTraded: number,
    curLpTokenPrice: number,
    protocolFee: number
  ): number {
    const valueToMint = valueTraded * protocolFee
    return valueToMint / curLpTokenPrice
  }

  // Constant product formula
  static calcK(pool: PoolBalance): number {
    return pool.market * pool.stable
  }

  /**
   * How many lp tokens to mint when an actor deposits liquidity
   */
  static calcLpTokensToMint(
    poolValueBefore: number,
    lpTokenSupplyBefore: number,
    poolValueAfter: number
  ): number {
    // valueBefore/supplyBefore == valueAfter/supplyAfter
    // Solve for supplyAfter
    const lpTokenSupplyAfter = (poolValueAfter * lpTokenSupplyBefore) / poolValueBefore

    // Sanity check this won't change LP token price
    if (
      Math.abs(
        this.calcLpTokenPrice(lpTokenSupplyBefore, poolValueBefore) -
          this.calcLpTokenPrice(lpTokenSupplyAfter, poolValueAfter)
      ) > DELTA
    ) {
      throw Error('minting LP tokens would change LP token price')
    }

    const lpTokensToMint = lpTokenSupplyAfter - lpTokenSupplyBefore
    return lpTokensToMint
  }

  /**
   * tokens to return to actor in exchange for lp tokens
   */
  static calcLpTokenRedemption(
    curPool: PoolBalance,
    curLpTokenSupply: number,
    lpTokensRedeemed: number
  ): PoolBalance {
    // Sanity check
    if (lpTokensRedeemed > curLpTokenSupply) {
      throw Error('cannot withdraw more LP tokens than exist in pool')
    }

    // Calculate proportion of pool being withdrawn
    const proportion = lpTokensRedeemed / curLpTokenSupply
    return {
      stable: curPool.stable * proportion,
      market: curPool.market * proportion,
    }
  }

  static calcVirtualLiquidity(pool: Pool): number {
    const {
      config: { bounds },
      realReserves,
    } = pool
    const { ceil, floor } = bounds
    const x = realReserves.market
    const y = realReserves.stable
    return (
      (0.5 *
        (Math.sqrt(ceil) * Math.sqrt(floor) * x +
          y +
          2.0 *
            Math.sqrt(
              -0.5 * Math.sqrt(ceil) * Math.sqrt(floor) * x * y +
                0.25 * ceil * floor * x ** 2 +
                ceil * x * y +
                0.25 * y ** 2
            ))) /
      (Math.sqrt(ceil) - Math.sqrt(floor))
    )
  }

  constructor(creator: Actor, config: PoolConfig, initialBalance: PoolBalance) {
    // Init base values
    this.config = config
    this.accumulatedFees = { stable: 0, market: 0 }
    this.realReserves = initialBalance

    // Init lp token balances
    this.lpTokenSupply = INITIAL_LP_SUPPLY
    this.lpBalances = new Map()
    this.lpBalances.set(creator, INITIAL_LP_SUPPLY)

    // Init virtual liquidity variables
    this.virtualLiquidity = Pool.calcVirtualLiquidity(this)
    this.sqrtPrice = Pool.initSqrtPrice(
      initialBalance.stable,
      this.virtualLiquidity,
      config.bounds.floor
    )
  }

  updateLpBalance(actor: Actor, delta: number): number {
    if (!this.lpBalances.has(actor)) this.lpBalances.set(actor, 0)

    const actorBalance = this.lpBalances.get(actor)
    if (typeof actorBalance !== 'number') {
      throw new Error(`couldn't find balances for ${actor.name}`)
    }

    this.lpBalances.set(actor, actorBalance + delta)
    if (actorBalance < 0 - DELTA) {
      throw Error(`actor ${actor.name} is broke, ran out of LP tokens in pool`)
    }

    return actorBalance
  }

  swapExactTokensForTokens(inToken: PoolToken, amountIn: number): number {
    const inTokenFee = amountIn * this.config.fee

    // Get trade amount
    const { amountOut, sqrtPriceDelta } = Pool.amountOutGivenIn(
      inToken,
      amountIn - inTokenFee,
      this.virtualLiquidity,
      this.sqrtPrice
    )

    if (amountOut < 0) {
      throw Error('not enough liquidity')
    }

    // Record fees
    this.accumulatedFees[inToken] += inTokenFee

    // Update real pool balance
    const outToken = inToken === 'stable' ? 'market' : 'stable'
    this.realReserves[inToken] += amountIn - inTokenFee
    this.realReserves[outToken] -= amountOut

    this.sqrtPrice += sqrtPriceDelta

    this._virtualLiquiditySanityCheck()

    return amountOut
  }

  swapTokensForExactTokens(
    outToken: PoolToken,
    amountOut: number,
    amountInLimit: number
  ): number | false {
    // Get amountIn
    const { amountIn: amountInBeforeFee, sqrtPriceDelta } = Pool.amountInGivenOut(
      outToken,
      amountOut,
      this.virtualLiquidity,
      this.sqrtPrice
    )

    const amountIn = amountInBeforeFee * (1 + this.config.fee)
    const inTokenFee = amountIn * this.config.fee

    // If it would cost over acceptable limit, fail the swap
    if (amountIn > amountInLimit) return false

    // Record fees
    const inToken = outToken === 'stable' ? 'market' : 'stable'
    this.accumulatedFees[inToken] += inTokenFee

    // Update real pool balance
    this.realReserves[inToken] += amountIn - inTokenFee
    this.realReserves[outToken] -= amountOut

    this.sqrtPrice += sqrtPriceDelta

    this._virtualLiquiditySanityCheck()

    return amountIn
  }

  deposit(actor: Actor, amountsIn: PoolBalance): void {
    // Deposit ratios must match ratio of realReserves in the pool
    const realReservesRatio = this.realReserves.stable / this.realReserves.market
    const amountsInRatio = amountsIn.stable / amountsIn.market
    if (Math.abs(realReservesRatio - amountsInRatio) > DELTA) {
      throw Error(`realReservesRatio ${realReservesRatio} !== amountsInRatio ${amountsInRatio}`)
    }

    const sqrtPriceBefore = this.sqrtPrice

    const poolValueBefore = Pool.calcPoolValue(this.realReserves, Pool.calcMarketTokenPrice(this))
    this.realReserves.stable += amountsIn.stable
    this.realReserves.market += amountsIn.market
    const poolValueAfter = Pool.calcPoolValue(this.realReserves, Pool.calcMarketTokenPrice(this))

    this.virtualLiquidity = Pool.calcVirtualLiquidity(this)

    const lpTokensToMint = Pool.calcLpTokensToMint(
      poolValueBefore,
      this.lpTokenSupply,
      poolValueAfter
    )
    this.lpTokenSupply += lpTokensToMint

    this.updateLpBalance(actor, lpTokensToMint)

    const virtualReserves = Pool.calcVirtualReserves(this)

    // sanity check: deposit should not change sqrtPrice
    const sqrtPriceAfter = virtualReserves.stable / this.virtualLiquidity
    if (Math.abs(sqrtPriceAfter - sqrtPriceBefore) > DELTA) {
      throw Error('deposit should not change sqrtPrice')
    }
  }

  withdraw(actor: Actor, lpTokensToWithdraw: number): PoolBalance {
    this.updateLpBalance(actor, -lpTokensToWithdraw)
    const { market, stable } = Pool.calcLpTokenRedemption(
      this.realReserves,
      this.lpTokenSupply,
      lpTokensToWithdraw
    )

    // Sanity check: ensure pool weight is unchanged
    if (Math.abs(market / stable - this.realReserves.market / this.realReserves.stable) > DELTA) {
      throw Error('tokens withdrawn weighting !== curPool weight')
    }

    this.realReserves.stable -= stable
    this.realReserves.market -= market
    this.lpTokenSupply -= lpTokensToWithdraw

    this.virtualLiquidity = Pool.calcVirtualLiquidity(this)

    // Tokens returned to LP
    return { stable, market }
  }

  getLpTokenBalance(actor: Actor): number {
    const actorBal = this.lpBalances.get(actor)
    if (typeof actorBal === 'number') {
      return actorBal
    }

    return 0
  }

  getRealReservesRatio(): number {
    return this.realReserves.stable / this.realReserves.market
  }

  _virtualLiquiditySanityCheck(): void {
    // Sanity check: virtual liquidity should not change more than 0.1%
    const tolerance = 0.01
    if (
      Math.abs(this.virtualLiquidity - Pool.calcVirtualLiquidity(this)) >
      this.virtualLiquidity * tolerance
    ) {
      throw Error(
        `L ${
          this.virtualLiquidity
        } changed more than tolerance ${tolerance} (L after swap ${Pool.calcVirtualLiquidity(
          this
        )})`
      )
    }
  }
}
