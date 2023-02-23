import Actor from './actor'
import Pool from './pool'
import { DELTA, EMPTY_MARKET_BALANCE } from '../constants'
import { findOptimalArbitrage } from '../helpers'
import { MarketToken, MarketConfig } from '../types'

interface MarketBalance {
  long: number
  short: number
}

export default class Market {
  config: MarketConfig
  name: string
  longPool: Pool
  shortPool: Pool
  private actorStableIn: Map<Actor, number>
  private actorStableOut: Map<Actor, number>
  private marketBalances: Map<Actor, MarketBalance>
  convertedStableTokens: number
  private arbitrageur: Actor

  constructor(name: string, config: MarketConfig, creatorStableDeposit: number, creator: Actor) {
    if (config.fee < config.protocolFee) {
      throw Error('config.fee must be >= config.protocolFee')
    }
    this.config = config
    this.name = name
    this.convertedStableTokens = 0
    this.marketBalances = new Map()
    this.actorStableIn = new Map()
    this.actorStableOut = new Map()
    this.arbitrageur = new Actor(`${name}-arbitrageur`, Number.MAX_SAFE_INTEGER)

    // Mint L/S tokens
    this.mint(creator, creatorStableDeposit / 2)

    // Create the pools
    const longPoolBounds = config.bounds
    const shortPoolBounds = {
      floor: 1 - config.bounds.ceil,
      ceil: 1 - config.bounds.floor,
    }
    const longPoolConfig = {
      bounds: longPoolBounds,
      fee: config.fee,
    }
    const shortPoolConfig = {
      bounds: shortPoolBounds,
      fee: config.fee,
    }
    this.longPool = new Pool(creator, longPoolConfig, {
      market: creatorStableDeposit / 2,
      stable: creatorStableDeposit / 4,
    })
    this.shortPool = new Pool(creator, shortPoolConfig, {
      market: creatorStableDeposit / 2,
      stable: creatorStableDeposit / 4,
    })

    // Deduct balances the creator deposited when creating the pools
    this.updateActorBalance(creator, 'long', -creatorStableDeposit / 2)
    this.updateActorBalance(creator, 'short', -creatorStableDeposit / 2)
    creator.setUsdBalance(creator.getUsdBalance() - creatorStableDeposit / 2)
    this.actorStableIn.set(creator, this.getActorStableIn(creator) + creatorStableDeposit / 2)
    this.rebalancePools()
  }

  // Use built-in arbitrageur to balance the pools so 1Long + 1Short = 1Stable
  rebalancePools(actor: Actor = this.arbitrageur): void {
    const { strategy, amount } = findOptimalArbitrage(
      this.longPool,
      this.shortPool,
      this.config.fee
    )
    if (strategy === 'deflate') {
      this.mint(actor, amount)
      const lOut = this.longPool.swapExactTokensForTokens('market', amount)
      const sOut = this.shortPool.swapExactTokensForTokens('market', amount)
      actor.setUsdBalance(actor.getUsdBalance() + sOut)
      actor.setUsdBalance(actor.getUsdBalance() + lOut)
    } else {
      const lIn = this.longPool.swapTokensForExactTokens('market', amount, actor.getUsdBalance())
      if (lIn === false) throw Error('insufficient funds to balance pool')
      actor.setUsdBalance(actor.getUsdBalance() - lIn)
      const sIn = this.shortPool.swapTokensForExactTokens('market', amount, actor.getUsdBalance())
      if (sIn === false) throw Error('insufficient funds to balance pool')
      actor.setUsdBalance(actor.getUsdBalance() - sIn)
      this.updateActorBalance(actor, 'short', amount)
      this.updateActorBalance(actor, 'long', amount)
      this.redeem(actor, amount)
    }

    // Sanity check: long + short = 1
    const longPrice = Pool.calcMarketTokenPrice(this.longPool)
    const shortPrice = Pool.calcMarketTokenPrice(this.shortPool)

    if (Math.abs(longPrice + shortPrice - 1) > 0.01) {
      throw Error(
        `rebalance failed to reset long+short=1, got long: ${longPrice} short: ${shortPrice} l+s=${
          longPrice + shortPrice
        }`
      )
    }
  }

  // Mint an equal amount of LONG / SHORT tokens for the actor
  mint(actor: Actor, amount: number): void {
    if (amount <= 0 || Number.isNaN(amount)) throw new Error('amount must be >0')

    // Deduct stables from minter
    actor.setUsdBalance(actor.getUsdBalance() - amount)

    // Mint the L/S
    this.updateActorBalance(actor, 'long', amount)
    this.updateActorBalance(actor, 'short', amount)

    // Record the deposit
    this.convertedStableTokens += amount
    this.actorStableIn.set(actor, this.getActorStableIn(actor) + amount)
  }

  // Deposit stables and become an LP
  deposit(actor: Actor, amount: number): void {
    if (amount <= 0 || Number.isNaN(amount)) throw new Error('amount must be >0')

    // Mint L/S tokens
    this.mint(actor, amount / 2)

    // Allocate more stables to pool that requires it -- this maximises
    // the neutrality of the LP position
    const totalLongToDeposit = amount / 2
    const totalShortToDeposit = amount / 2
    const longPrice = Pool.calcMarketTokenPrice(this.longPool)

    const totalStableToDepositToLongPool = (amount / 2) * (1 - longPrice)
    const totalStableToDepositToShortPool = (amount / 2) * longPrice

    // Deposit all LONG using 1/2 of remaining stables
    let remainingLongToDeposit = totalLongToDeposit
    let remainingStableToDepositToLongPool = totalStableToDepositToLongPool

    while (remainingLongToDeposit > DELTA && remainingStableToDepositToLongPool > DELTA) {
      const longPoolRatio = this.longPool.getRealReservesRatio()
      const remainingToDepositRatio = remainingStableToDepositToLongPool / remainingLongToDeposit
      // We have enough stable to deposit all our remaining long
      if (remainingToDepositRatio > longPoolRatio) {
        const longToDeposit = remainingLongToDeposit
        const stableToDeposit = remainingLongToDeposit * longPoolRatio
        this.longPool.deposit(actor, {
          market: longToDeposit,
          stable: stableToDeposit,
        })
        remainingLongToDeposit -= longToDeposit
        remainingStableToDepositToLongPool -= stableToDeposit
        // Swap half the remaining stable for long
        const longOut = this.longPool.swapExactTokensForTokens(
          'stable',
          remainingStableToDepositToLongPool / 2
        )
        this.rebalancePools()
        remainingLongToDeposit += longOut
        remainingStableToDepositToLongPool /= 2
      } else {
        // We have enough long to deposit all our remaining stable
        const stableToDeposit = remainingStableToDepositToLongPool
        const longToDeposit = stableToDeposit / longPoolRatio
        this.longPool.deposit(actor, {
          market: longToDeposit,
          stable: stableToDeposit,
        })
        remainingLongToDeposit -= longToDeposit
        remainingStableToDepositToLongPool -= stableToDeposit
        // Swap half the remaining long for stable
        const stableOut = this.longPool.swapExactTokensForTokens(
          'market',
          remainingLongToDeposit / 2
        )
        this.rebalancePools()
        remainingLongToDeposit /= 2
        remainingStableToDepositToLongPool += stableOut
      }
    }

    // Deposit all SHORT using 1/2 of remaining stables
    let remainingShortToDeposit = totalShortToDeposit
    let remainingStableToDepositToShortPool = totalStableToDepositToShortPool
    while (remainingShortToDeposit > DELTA && remainingStableToDepositToShortPool > DELTA) {
      const shortPoolRatio = this.shortPool.getRealReservesRatio()
      const remainingToDepositRatio = remainingStableToDepositToShortPool / remainingShortToDeposit
      // We have enough stable to deposit all our remaining short
      if (remainingToDepositRatio > shortPoolRatio) {
        const shortToDeposit = remainingShortToDeposit
        const stableToDeposit = remainingShortToDeposit * shortPoolRatio
        this.shortPool.deposit(actor, {
          market: shortToDeposit,
          stable: stableToDeposit,
        })
        remainingShortToDeposit -= shortToDeposit
        remainingStableToDepositToShortPool -= stableToDeposit
        // Swap half the remaining stable for short
        const shortOut = this.shortPool.swapExactTokensForTokens(
          'stable',
          remainingStableToDepositToShortPool / 2
        )
        this.rebalancePools()
        remainingShortToDeposit += shortOut
        remainingStableToDepositToShortPool /= 2
      } else {
        // We have enough short to deposit all our remaining stable
        const stableToDeposit = remainingStableToDepositToShortPool
        const shortToDeposit = stableToDeposit / shortPoolRatio
        this.shortPool.deposit(actor, {
          market: shortToDeposit,
          stable: stableToDeposit,
        })
        remainingShortToDeposit -= shortToDeposit
        remainingStableToDepositToShortPool -= stableToDeposit
        // Swap half the remaining short for stable
        const stableOut = this.shortPool.swapExactTokensForTokens(
          'market',
          remainingShortToDeposit / 2
        )
        this.rebalancePools()
        remainingShortToDeposit /= 2
        remainingStableToDepositToShortPool += stableOut
      }
    }

    // Update balances
    this.updateActorBalance(actor, 'long', -(amount / 2))
    this.updateActorBalance(actor, 'short', -(amount / 2))
    actor.setUsdBalance(actor.getUsdBalance() - amount / 2)
    this.actorStableIn.set(actor, this.getActorStableIn(actor) + amount / 2)
  }

  // Withdraw percent of LP position from each pool
  withdraw(actor: Actor, percent: number): void {
    // Pull from long pool
    const { market: redeemedLong, stable: longRedeemedStable } = this.longPool.withdraw(
      actor,
      this.longPool.getLpTokenBalance(actor) * percent
    )
    this.updateActorBalance(actor, 'long', redeemedLong)
    actor.setUsdBalance(actor.getUsdBalance() + longRedeemedStable)
    this.actorStableOut.set(actor, this.getActorStableOut(actor) + longRedeemedStable)

    // Poll from short pool
    const { market: redeemedShort, stable: shortRedeemedStable } = this.shortPool.withdraw(
      actor,
      this.shortPool.getLpTokenBalance(actor) * percent
    )
    this.updateActorBalance(actor, 'short', redeemedShort)
    actor.setUsdBalance(actor.getUsdBalance() + shortRedeemedStable)
    this.actorStableOut.set(actor, this.getActorStableOut(actor) + shortRedeemedStable)

    // Redeem as much as possible from the stables held as collateral
    const redeemAmount = Math.min(redeemedShort, redeemedLong)
    this.redeem(actor, redeemAmount)

    // If the LP has any remaining market tokens on their balance sheet they
    // can redeem for stables via a swap
    const { long: rLong, short: rShort } = this.getActorBalance(actor)
    let rStable = 0
    if (rLong > 0) {
      rStable = this.longPool.swapExactTokensForTokens('market', rLong)
    } else if (rShort > 0) {
      rStable = this.shortPool.swapExactTokensForTokens('market', rShort)
    }

    // If we have any remaining stable, finally withdraw it
    if (rStable > 0) {
      actor.setUsdBalance(actor.getUsdBalance() + rStable)
      this.actorStableOut.set(actor, this.getActorStableOut(actor) + rStable)
    }

    // Trade away any price imbalances
    this.rebalancePools()
  }

  redeem(actor: Actor, amount: number): void {
    if (amount <= 0 || Number.isNaN(amount)) throw new Error('amount must be >0')

    // Credit stables from redeemer
    actor.setUsdBalance(actor.getUsdBalance() + amount)

    // Deduct the L/S
    this.updateActorBalance(actor, 'long', -amount)
    this.updateActorBalance(actor, 'short', -amount)

    // Record the withdrawal
    this.convertedStableTokens -= amount
    this.actorStableOut.set(actor, this.getActorStableOut(actor) + amount)
  }

  openPosition(actor: Actor, direction: MarketToken, amount: number): void {
    if (amount <= 0) throw new Error('amount must be >0')

    // Trader simply swaps with the underlying pool
    const pool = direction === 'long' ? this.longPool : this.shortPool

    // Deduct stable balance from trader
    actor.setUsdBalance(actor.getUsdBalance() - amount)
    this.actorStableIn.set(actor, this.getActorStableIn(actor) + amount)

    // Swap tokens
    const amountOut = pool.swapExactTokensForTokens('stable', amount)

    // Credit market tokens to trader
    this.updateActorBalance(actor, direction, amountOut)

    // Trade away any price imbalances
    this.rebalancePools()
  }

  /*
   * ALPHA method that uses brute force to trade a market to a desired longPrice
   * TODO add max trade size to protect against using all of trader bal
   * TODO use more efficient method
   * TODO add proper testing
   * TODO deduct / credit actor bal who is trading
   */
  tradeToTargetPrice(actor: Actor, targetLongPrice: number): void {
    let curLongPrice = Pool.calcMarketTokenPrice(this.longPool)
    while (curLongPrice < targetLongPrice - 0.0001) {
      const size = Pool.calcMarketTradeSizeToTargetPrice(
        this.longPool.virtualLiquidity,
        this.longPool.sqrtPrice,
        targetLongPrice
      )
      this.longPool.swapTokensForExactTokens('market', size, Number.MAX_SAFE_INTEGER)
      this.rebalancePools()
      curLongPrice = Pool.calcMarketTokenPrice(this.longPool)
    }

    while (curLongPrice > targetLongPrice + 0.0001) {
      const size = Pool.calcMarketTradeSizeToTargetPrice(
        this.shortPool.virtualLiquidity,
        this.shortPool.sqrtPrice,
        1 - targetLongPrice
      )
      this.shortPool.swapTokensForExactTokens('market', size, Number.MAX_SAFE_INTEGER)
      this.rebalancePools()
      curLongPrice = Pool.calcMarketTokenPrice(this.longPool)
    }
  }

  closePosition(actor: Actor, direction: MarketToken, amount: number): void {
    if (amount <= 0 || Number.isNaN(amount)) throw new Error('amount must be >0')

    // Trader simply swaps with the underlying pool
    const pool = direction === 'long' ? this.longPool : this.shortPool

    // Deduct market tokens from trader
    this.updateActorBalance(actor, direction, -amount)

    // Swap tokens
    const amountOut = pool.swapExactTokensForTokens('market', amount)

    // Credit stable tokens to trader
    actor.setUsdBalance(actor.getUsdBalance() + amountOut)
    this.actorStableOut.set(actor, this.getActorStableOut(actor) + amountOut)

    // Trade away any price imbalances
    this.rebalancePools()
  }

  updateActorBalance(actor: Actor, token: MarketToken, delta: number): void {
    // If needed, init bal
    if (!this.marketBalances.has(actor)) {
      this.marketBalances.set(actor, { ...EMPTY_MARKET_BALANCE })
    }

    const balances = this.marketBalances.get(actor)
    if (!balances) {
      throw new Error(`couldn't find balances for actor ${actor.name} in market ${this.name}`)
    }

    balances[token] += delta
    if (balances[token] < 0 - DELTA) {
      throw Error(`actor ${actor.name} is broke. ran out of ${token} tokens in market ${this.name}`)
    }
  }

  getActorBalance(actor: Actor): MarketBalance {
    const balance = this.marketBalances.get(actor)
    if (balance) return balance
    return { ...EMPTY_MARKET_BALANCE }
  }

  getActorStableIn(actor: Actor): number {
    // If needed, init bal
    if (!this.actorStableIn.has(actor)) this.actorStableIn.set(actor, 0)

    const stableIn = this.actorStableIn.get(actor)

    if (typeof stableIn !== 'number') {
      throw new Error(`error getting actor ${actor.name} stable in`)
    }

    return stableIn
  }

  getActorStableOut(actor: Actor): number {
    // If needed, init bal
    if (!this.actorStableOut.has(actor)) this.actorStableOut.set(actor, 0)

    const stableOut = this.actorStableOut.get(actor)

    if (typeof stableOut !== 'number') {
      throw new Error(`error getting actor ${actor.name} stable in`)
    }

    return stableOut
  }

  getActorNetWorth(actor: Actor): number {
    const longLpTokenWorth =
      Pool.calcLpTokenPrice(
        this.longPool.lpTokenSupply,
        Pool.calcPoolValue(this.longPool.realReserves, Pool.calcMarketTokenPrice(this.longPool))
      ) * this.longPool.getLpTokenBalance(actor)

    const shortLpTokenWorth =
      Pool.calcLpTokenPrice(
        this.shortPool.lpTokenSupply,
        Pool.calcPoolValue(this.shortPool.realReserves, Pool.calcMarketTokenPrice(this.shortPool))
      ) * this.shortPool.getLpTokenBalance(actor)

    const { long, short } = this.getActorBalance(actor)
    const longTokenWorth = Pool.calcMarketTokenPrice(this.longPool) * long
    const shortTokenWorth = Pool.calcMarketTokenPrice(this.shortPool) * short
    return longLpTokenWorth + shortLpTokenWorth + longTokenWorth + shortTokenWorth
  }

  getActorNetProfit(actor: Actor): { amount: number; percent: number } {
    const amount =
      this.getActorNetWorth(actor) + this.getActorStableOut(actor) - this.getActorStableIn(actor)

    const percent = this.getActorStableIn(actor) > 0 ? amount / this.getActorStableIn(actor) : 0

    return { amount, percent }
  }

  getLongPrice(): number {
    return Pool.calcMarketTokenPrice(this.longPool)
  }
}
