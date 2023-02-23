import { NETWORKS } from 'prepo-constants'
import { StoreConfig } from 'prepo-stores'
import { SupportedContracts } from '../../lib/contract.types'
import { supportedContracts } from '../../lib/supported-contracts'

export const storeConfig: StoreConfig<SupportedContracts> = {
  appName: `https://app.prepo.io`,
  defaultNetwork: NETWORKS.goerli,
  supportedNetworks: [NETWORKS.goerli],
  supportedContracts,
}
