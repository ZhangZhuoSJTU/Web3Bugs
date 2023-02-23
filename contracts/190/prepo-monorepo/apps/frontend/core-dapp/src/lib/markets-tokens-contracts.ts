import { ExternalContract } from './contract.types'

export type SupportedMarketTokens =
  | 'PREFAKESTOCK_LONG_TOKEN'
  | 'PREFAKESTOCK_SHORT_TOKEN'
  | 'PREFAKETOKEN_LONG_TOKEN'
  | 'PREFAKETOKEN_SHORT_TOKEN'

export const PREFAKESTOCK_LONG_TOKEN: ExternalContract = {
  goerli: '0xc463E78ecE6ED599cF4443098902ee33817AbE8D',
}

export const PREFAKESTOCK_SHORT_TOKEN: ExternalContract = {
  goerli: '0xEd8690E944C4D405F92C1a38117C31440510210c',
}

export const PREFAKETOKEN_LONG_TOKEN: ExternalContract = {
  goerli: '0xDed125CA0029206731560f094fa7C393b3251e56',
}

export const PREFAKETOKEN_SHORT_TOKEN: ExternalContract = {
  goerli: '0x262f7263d2683e106109f216fF720D9f3eB69ca6',
}

type SupportedMarketTokensContract = {
  [key in SupportedMarketTokens]: ExternalContract
}

export const supportedMarketTokens: SupportedMarketTokensContract = {
  PREFAKESTOCK_LONG_TOKEN,
  PREFAKESTOCK_SHORT_TOKEN,
  PREFAKETOKEN_LONG_TOKEN,
  PREFAKETOKEN_SHORT_TOKEN,
}
