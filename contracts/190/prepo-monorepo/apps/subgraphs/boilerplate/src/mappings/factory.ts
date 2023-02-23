import { MarketAdded } from '../generated/types/PrePOMarketFactory/PrePOMarketFactory'
import { Market, Token } from '../generated/types/schema'
import { PrePOMarket as PrePOMarketTemplate } from '../generated/types/templates'
import { MarketCreated } from '../generated/types/templates/PrePOMarket/PrePOMarket'

export function handleMarketAdded(event: MarketAdded): void {
  PrePOMarketTemplate.create(event.params.market)
}

export function handleMarketCreated(event: MarketCreated): void {
  const marketAddress = event.address.toHexString()
  const longTokenAddress = event.params.longToken.toHexString()
  const shortTokenAddress = event.params.shortToken.toHexString()

  const longToken = new Token(longTokenAddress)
  longToken.market = marketAddress

  const shortToken = new Token(shortTokenAddress)
  shortToken.market = marketAddress

  const market = new Market(marketAddress)
  market.longToken = longTokenAddress
  market.shortToken = shortTokenAddress
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
