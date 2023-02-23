/* eslint-disable no-restricted-syntax */
import { ChainId, Network, NETWORKS, SupportedNetworks } from 'prepo-constants'

export const getNetworkByChainId = (chainId: ChainId | undefined): Network | undefined => {
  for (const key in NETWORKS) {
    if ({}.hasOwnProperty.call(NETWORKS, key)) {
      const network = key as SupportedNetworks
      if (NETWORKS[network].chainId === chainId) {
        return NETWORKS[network]
      }
    }
  }

  return undefined
}
