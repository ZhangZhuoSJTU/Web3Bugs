import { Network, NETWORKS, SupportedNetworks } from 'prepo-constants'

export const DYNAMIC_CONTRACT_ADDRESS = 'DYNAMIC'

export const getNetworkByChainId = (chainId: number | undefined): Network | undefined => {
  // eslint-disable-next-line no-restricted-syntax
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
