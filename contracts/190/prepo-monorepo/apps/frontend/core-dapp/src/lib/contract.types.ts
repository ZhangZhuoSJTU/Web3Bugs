import { SupportedNetworks } from 'prepo-constants'
import { CoreTokenContractNames } from './core-contracts'
import { SupportedExternalContractsNames } from './external-contracts'
import { SupportedMarkets } from './markets-contracts'
import { SupportedMarketPools } from './markets-pool-contracts'
import { SupportedMarketTokens } from './markets-tokens-contracts'

export type ExternalContract = {
  [key in SupportedNetworks]?: string
}

export type SupportedContractsNames =
  | SupportedExternalContractsNames
  | CoreTokenContractNames
  | SupportedMarkets
  | SupportedMarketPools
  | SupportedMarketTokens

export type SupportedContracts = {
  [key in SupportedContractsNames]?: ExternalContract
}
