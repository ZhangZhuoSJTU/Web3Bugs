import { SupportedContracts } from './contract.types'
import { appContracts } from './app-contracts'
import { supportedExternalTokenContracts } from './external-contracts'

export const supportedContracts: SupportedContracts = {
  ...supportedExternalTokenContracts,
  ...appContracts,
}
