import { Address, BigInt } from '@graphprotocol/graph-ts'
import { LongShortToken, Pool, Position, Token } from '../generated/types/schema'
import { LongShortToken as LongShortTokenContract } from '../generated/types/templates/LongShortToken/LongShortToken'
import { Swap } from '../generated/types/templates/UniswapV3Pool/UniswapV3Pool'
import { ZERO_BD } from '../utils/constants'
import { convertTokenToDecimal, sqrtPriceX96ToTokenPrices } from '../utils/math'

export function updateLongShortPrices(event: Swap, pool: Pool): void {
  const collateralAt0 = pool.collateralTokenPosition.equals(BigInt.fromI32(0))
  const longShortToken = LongShortToken.load(pool.longShortToken)
  const collateralERC20 = Token.load(pool.collateralToken)
  const longShortERC20 = Token.load(pool.longShortToken)

  pool.sqrtPriceX96 = event.params.sqrtPriceX96

  if (longShortToken !== null && collateralERC20 !== null && longShortERC20 !== null) {
    const token0Decimal = collateralAt0 ? collateralERC20.decimals : longShortERC20.decimals
    const token1Decimal = collateralAt0 ? longShortERC20.decimals : collateralERC20.decimals

    const prices = sqrtPriceX96ToTokenPrices(
      event.params.sqrtPriceX96,
      token0Decimal,
      token1Decimal
    )

    pool.token0Price = prices[0]
    pool.token1Price = prices[1]
    longShortToken.priceUSD = collateralAt0 ? prices[0] : prices[1]

    longShortToken.save()
  }
  pool.save()
}

export function updatePosition(ownerAddress: Address, tokenAddress: Address, amount: BigInt): void {
  const ownerAddressString = ownerAddress.toHexString()
  const tokenAddressString = tokenAddress.toHexString()
  const id = `${tokenAddressString}-${ownerAddressString}`

  const longShortToken = LongShortToken.load(tokenAddressString)
  const longShortERC20 = Token.load(tokenAddressString)
  if (longShortToken === null || longShortERC20 === null) return
  const tokenContract = LongShortTokenContract.bind(tokenAddress)
  const latestBalance = tokenContract.balanceOf(ownerAddress)
  const balanceBD = convertTokenToDecimal(latestBalance, longShortERC20.decimals)
  const amountBD = convertTokenToDecimal(amount, longShortERC20.decimals)
  const prevBalance = balanceBD.minus(amountBD)

  let position = Position.load(id)
  if (position === null) {
    position = new Position(id)
    position.ownerAddress = ownerAddressString
    position.longShortToken = tokenAddressString
    position.costBasis = ZERO_BD
  }

  // newCostBasis = ((prevBalance * curCostBasis) + (boughtAmount * curPrice)) / (curBal + boughtAmount)
  const curWeight = prevBalance.times(position.costBasis)
  const newWeight = amountBD.times(longShortToken.priceUSD)
  const totalWeight = curWeight.plus(newWeight)
  const costBasis = totalWeight.div(balanceBD)
  position.costBasis = costBasis
  position.save()
}
