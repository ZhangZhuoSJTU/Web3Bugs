import { BigInt } from '@graphprotocol/graph-ts'
import {
  CollateralValidityChanged,
  MarketAdded,
} from '../generated/types/PrePOMarketFactory/PrePOMarketFactory'
import {
  Market,
  Pool,
  Token,
  CollateralToken as CollateralTokenEntity,
  LongShortToken,
  BaseToken as BaseTokenEntity,
} from '../generated/types/schema'
import {
  BaseToken as BaseTokenTemplate,
  CollateralToken as CollateralTokenTemplate,
  PrePOMarket as PrePOMarketTemplate,
  LongShortToken as LongShortTokenTemplate,
  UniswapV3Pool as UniswapV3PoolTemplate,
} from '../generated/types/templates'
import { MarketCreated } from '../generated/types/templates/PrePOMarket/PrePOMarket'
import { PoolCreated } from '../generated/types/UniswapV3PoolFactory/UniswapV3PoolFactory'
import {
  TOKEN_TYPE_COLLATERAL,
  TOKEN_TYPE_COLLATERAL_BASE,
  TOKEN_TYPE_LONG_SHORT,
  ZERO_BD,
  ZERO_BI,
} from '../utils/constants'
import { CollateralToken } from '../generated/types/PrePOMarketFactory/CollateralToken'
import { fetchERC20 } from '../utils/ERC20'

export function handleCollateralValidityChanged(event: CollateralValidityChanged): void {
  const collateralAddress = event.params.collateral.toHexString()
  let collateral = CollateralTokenEntity.load(collateralAddress)
  if (collateral === null) {
    const collateralERC20 = fetchERC20(event.params.collateral, TOKEN_TYPE_COLLATERAL)
    const collateralContract = CollateralToken.bind(event.params.collateral)
    const baseTokenResult = collateralContract.try_getBaseToken()
    const treasuryResult = collateralContract.try_getTreasury()

    const invalidCollateralInterface =
      !collateralERC20 || baseTokenResult.reverted || treasuryResult.reverted
    if (invalidCollateralInterface) return
    const baseERC20 = fetchERC20(baseTokenResult.value, TOKEN_TYPE_COLLATERAL_BASE)

    // base token is invalid erc20
    if (!baseERC20) return
    const base = new BaseTokenEntity(baseERC20.id)

    base.collateral = collateralAddress
    base.token = base.id
    base.save()

    collateral = new CollateralTokenEntity(collateralAddress)
    collateral.baseToken = baseERC20.id
    collateral.token = collateral.id
    collateral.treasuryAddress = treasuryResult.value.toHexString()

    BaseTokenTemplate.create(baseTokenResult.value)
    CollateralTokenTemplate.create(event.params.collateral)
  }
  collateral.allowed = event.params.allowed
  collateral.save()
}

export function handleMarketAdded(event: MarketAdded): void {
  PrePOMarketTemplate.create(event.params.market)
}

export function handleMarketCreated(event: MarketCreated): void {
  const marketAddress = event.address.toHexString()
  const longERC20 = fetchERC20(event.params.longToken, TOKEN_TYPE_LONG_SHORT)
  const shortERC20 = fetchERC20(event.params.shortToken, TOKEN_TYPE_LONG_SHORT)

  // invalid tokens
  if (!longERC20 || !shortERC20) return
  const longToken = new LongShortToken(longERC20.id)
  longToken.market = marketAddress
  longToken.priceUSD = ZERO_BD
  longToken.token = longToken.id

  const shortToken = new LongShortToken(shortERC20.id)
  shortToken.market = marketAddress
  shortToken.priceUSD = ZERO_BD
  shortToken.token = shortToken.id

  // start tracking transfer event of theses tokens
  LongShortTokenTemplate.create(event.params.longToken)
  LongShortTokenTemplate.create(event.params.shortToken)

  const market = new Market(marketAddress)
  market.longToken = longERC20.id
  market.shortToken = shortERC20.id
  market.ceilingLongPrice = event.params.ceilingLongPrice
  market.ceilingValuation = event.params.ceilingValuation
  market.expiryTime = event.params.expiryTime
  market.floorLongPrice = event.params.floorLongPrice
  market.floorValuation = event.params.floorValuation
  market.mintingFee = event.params.mintingFee
  market.redemptionFee = event.params.redemptionFee
  market.createdAtBlockNumber = event.block.number
  market.createdAtTimestamp = event.block.timestamp
  longToken.save()
  shortToken.save()
  market.save()
}

export function handlePoolCreated(event: PoolCreated): void {
  const token0Address = event.params.token0.toHexString()
  const token1Address = event.params.token1.toHexString()
  const token0 = Token.load(token0Address)
  const token1 = Token.load(token1Address)

  // irrelevant pools
  if (token0 === null || token1 === null) return

  // only track if one side is long short token and the other is collateral
  const tokenTypesList: string[] = []
  tokenTypesList.push(token0.type)
  tokenTypesList.push(token1.type)
  const hasLongShortToken = tokenTypesList.includes(TOKEN_TYPE_LONG_SHORT)
  const hasCollateralToken = tokenTypesList.includes(TOKEN_TYPE_COLLATERAL)
  if (!hasLongShortToken || !hasCollateralToken) return

  const collateralTokenPosition = token0.type == TOKEN_TYPE_COLLATERAL ? 0 : 1

  const poolAddress = event.params.pool.toHexString()
  const pool = new Pool(poolAddress)
  pool.longShortToken = collateralTokenPosition === 0 ? token1.id : token0.id
  pool.collateralToken = collateralTokenPosition === 0 ? token0.id : token1.id
  pool.collateralTokenPosition = BigInt.fromI32(collateralTokenPosition)
  pool.token0 = token0.id
  pool.token1 = token1.id
  pool.token0Price = ZERO_BD
  pool.token1Price = ZERO_BD
  pool.sqrtPriceX96 = ZERO_BI
  pool.createdAtBlockNumber = event.block.number
  pool.createdAtTimestamp = event.block.timestamp

  UniswapV3PoolTemplate.create(event.params.pool)
  pool.save()
}
