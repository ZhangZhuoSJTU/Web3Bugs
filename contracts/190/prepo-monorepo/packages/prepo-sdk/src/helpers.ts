import { DELTA } from './constants'
import Pool from './simulation-tool/pool'
import { PoolBalance } from './types'

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)
}
function findOptimalArbitrageBinary(
  longVirtualReserves: PoolBalance,
  shortVirtualReserves: PoolBalance,
  fee: number,
  strategy: ArbitrageStrategy,
  min: number,
  max: number
): number {
  if (Math.abs(min - max) < DELTA) {
    throw Error('possible infinite recursion, terminating')
  }

  const mid = (max + min) / 2
  const result =
    (longVirtualReserves.market * longVirtualReserves.stable) /
      (longVirtualReserves.market + mid * (1 - fee)) ** 2 +
    (shortVirtualReserves.market * shortVirtualReserves.stable) /
      (shortVirtualReserves.market + mid * (1 - fee)) ** 2

  if (Math.abs(result - 1) < DELTA) return Math.abs(mid)

  if (result > 1) {
    return findOptimalArbitrageBinary(
      longVirtualReserves,
      shortVirtualReserves,
      fee,
      strategy,
      mid,
      max
    )
  }

  return findOptimalArbitrageBinary(
    longVirtualReserves,
    shortVirtualReserves,
    fee,
    strategy,
    min,
    mid
  )
}
type ArbitrageStrategy = 'inflate' | 'deflate'

// Find optimal strategy for an arbitaguer to balance long and short pools
// See "Arbitrage Maf" https://www.notion.so/Mafs-911f7117925b4678bc06f0523db4dee0
function findOptimalArbitrage(
  longPool: Pool,
  shortPool: Pool,
  fee: number
): { strategy: ArbitrageStrategy; amount: number } {
  const longRealReserves = longPool.realReserves
  const shortRealReserves = shortPool.realReserves
  const maxOut = Math.max(
    longRealReserves.market,
    longRealReserves.stable,
    shortRealReserves.market,
    shortRealReserves.stable
  )
  const longPrice = Pool.calcMarketTokenPrice(longPool)
  const shortPrice = Pool.calcMarketTokenPrice(shortPool)
  const longVirtualReserves = Pool.calcVirtualReserves(longPool)
  const shortVirtualReserves = Pool.calcVirtualReserves(shortPool)
  if (longPrice + shortPrice > 1) {
    const strategy = 'deflate'
    const amount = findOptimalArbitrageBinary(
      longVirtualReserves,
      shortVirtualReserves,
      fee,
      strategy,
      0,
      maxOut
    )
    return { strategy, amount }
  }

  const strategy = 'inflate'
  const amount = findOptimalArbitrageBinary(
    longVirtualReserves,
    shortVirtualReserves,
    fee,
    strategy,
    -maxOut,
    0
  )
  return { strategy, amount }
}

export { formatUsd, formatNumber, findOptimalArbitrage }
