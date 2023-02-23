/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: selectively remove/replace collateral related methods with preUSD
import { ethers } from 'hardhat'
import { PrePOMarket } from '../typechain/PrePOMarket'
import { PrePOMarketFactory } from '../typechain/PrePOMarketFactory'

export async function getMarketAddedEvent(factory: PrePOMarketFactory): Promise<any> {
  const filter = {
    address: factory.address,
    topics: [ethers.utils.id('MarketAdded(address,bytes32)')],
  }
  const events = await factory.queryFilter(filter, 'latest')
  return events[0].args as any
}

export async function getMarketCreatedEvent(market: PrePOMarket): Promise<any> {
  const filter = {
    address: market.address,
    topics: [
      ethers.utils.id(
        'MarketCreated(address,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256)'
      ),
    ],
  }
  const events = await market.queryFilter(filter, 'latest')
  return events[0].args as any
}
