import { SupportedContracts } from './contract.types'
import { coreContracts } from './core-contracts'
import { supportedExternalTokenContracts } from './external-contracts'
import { supportedMarketTokens } from './markets-tokens-contracts'
import { supportedMarkets } from './markets-contracts'
import { supportedMarketPools } from './markets-pool-contracts'

export const supportedContracts: SupportedContracts = {
  ...supportedExternalTokenContracts,
  ...coreContracts,
  ...supportedMarkets,
  ...supportedMarketPools,
  ...supportedMarketTokens,
}
