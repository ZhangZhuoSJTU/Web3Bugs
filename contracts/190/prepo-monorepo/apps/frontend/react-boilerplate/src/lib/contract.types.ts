import { SupportedNetworks } from 'prepo-constants'
import { AppContractNames } from './app-contracts'
import { SupportedExternalTokenContractsNames } from './external-contracts'

export type ExternalContract = {
  [key in SupportedNetworks]?: string
}

export type SupportedContractsNames = SupportedExternalTokenContractsNames | AppContractNames

export type SupportedContracts = {
  [key in SupportedContractsNames]?: ExternalContract
}
