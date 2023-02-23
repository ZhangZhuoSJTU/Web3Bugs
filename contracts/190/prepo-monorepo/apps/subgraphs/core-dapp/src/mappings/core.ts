import { updateLongShortPrices, updatePosition } from './accounting'
import {
  addBaseTokenTransactions,
  addCollateralTransactions,
  addLongShortTokenTransactions,
  addSwapTransactions,
} from './transaction'
import { Swap } from '../generated/types/templates/UniswapV3Pool/UniswapV3Pool'
import { Pool } from '../generated/types/schema'
import { Transfer as ERC20Transfer } from '../generated/types/templates/BaseToken/ERC20'

export function handleBaseTokenTransfer(event: ERC20Transfer): void {
  addBaseTokenTransactions(event)
}

export function handleCollateralTokenTransfer(event: ERC20Transfer): void {
  addCollateralTransactions(event)
}

export function handleLongShortTokenTransfer(event: ERC20Transfer): void {
  updatePosition(event.params.to, event.address, event.params.value)
  addLongShortTokenTransactions(event)
}

export function handleUniswapV3Swap(event: Swap): void {
  const pool = Pool.load(event.address.toHexString())
  if (pool === null) return // swaps irrelevant to prePO

  updateLongShortPrices(event, pool)
  addSwapTransactions(event, pool)
}
