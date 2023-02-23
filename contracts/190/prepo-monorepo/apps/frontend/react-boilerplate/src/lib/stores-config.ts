import { NETWORKS } from 'prepo-constants'
import { StoreConfig } from 'prepo-stores'
import { PROJECT_NAME } from './constants'
import { SupportedContracts } from './contract.types'
import { supportedContracts } from './supported-contracts'

export const storeConfig: StoreConfig<SupportedContracts> = {
  appName: `prepo.${PROJECT_NAME}`,
  defaultNetwork: NETWORKS.goerli,
  supportedNetworks: [NETWORKS.goerli],
  supportedContracts,
}
