import { FALLBACK_PROVIDER_CONFIG, Network } from 'prepo-constants'
import { ethers } from 'ethers'

const { STALL_TIMEOUT, QUORUM } = FALLBACK_PROVIDER_CONFIG

// Take the JsonRpcBatchProvider and give it the detectNetwork method of the StaticJsonRpcProvider
export class StaticJsonRpcBatchProvider extends ethers.providers.JsonRpcBatchProvider {
  detectNetwork = ethers.providers.StaticJsonRpcProvider.prototype.detectNetwork.bind(this)
}

export const createFallbackProvider = (network: Network): ethers.providers.FallbackProvider => {
  const { rpcUrls } = network
  const fallbackProviderConfigs = rpcUrls
    .map((rpcUrl) => new StaticJsonRpcBatchProvider(rpcUrl, network.chainId))
    .map((provider, i) => ({ provider, priority: i, stallTimeout: STALL_TIMEOUT, weight: 1 }))
  return new ethers.providers.FallbackProvider(fallbackProviderConfigs, QUORUM)
}
