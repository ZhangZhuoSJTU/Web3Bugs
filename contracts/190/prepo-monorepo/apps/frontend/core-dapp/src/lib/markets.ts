import { Market, SupportedMarketID } from '../types/market.types'

const fakestock: Market = {
  address: 'PREFAKESTOCK_MARKET_ADDRESS',
  iconName: 'prefakestock',
  name: 'Fake Stock',
  type: 'preIPO',
  companyName: 'Fake Stock',
  urlId: 'fakestock',
  long: {
    tokenAddress: 'PREFAKESTOCK_LONG_TOKEN',
    poolAddress: 'PREFAKESTOCK_LONG_POOL',
  },
  short: {
    tokenAddress: 'PREFAKESTOCK_SHORT_TOKEN',
    poolAddress: 'PREFAKESTOCK_SHORT_POOL',
  },
  static: {
    valuationRange: [15000000000, 45000000000],
  },
}

const faketoken: Market = {
  address: 'PREFAKETOKEN_MARKET_ADDRESS',
  iconName: 'prefaketoken',
  name: 'Fake Token',
  type: 'preICO',
  companyName: 'Fake Token',
  urlId: 'faketoken',
  long: {
    tokenAddress: 'PREFAKETOKEN_LONG_TOKEN',
    poolAddress: 'PREFAKETOKEN_LONG_POOL',
  },
  short: {
    tokenAddress: 'PREFAKETOKEN_SHORT_TOKEN',
    poolAddress: 'PREFAKETOKEN_SHORT_POOL',
  },
  static: {
    valuationRange: [1000000000, 5000000000],
  },
}

export const markets = [fakestock, faketoken]
export const marketsMap: { [key in SupportedMarketID]: Market } = {
  fakestock,
  faketoken,
}
