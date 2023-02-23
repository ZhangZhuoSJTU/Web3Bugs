import { ChainId, Network } from 'prepo-constants'

type MetamaskNetwork = {
  chainName: string
  rpcUrls: string[]
  blockExplorerUrls: string[]
  chainId: string
}

const DEFAULT_NETWORKS = [
  ChainId.Mainnet,
  ChainId.Goerli,
  ChainId.Rinkeby,
  ChainId.Ropsten,
  ChainId.Kovan,
]

export const addNetworkToMetamask = async ({
  chainName,
  chainId: decChainId,
  blockExplorer,
  rpcUrls,
}: Network): Promise<boolean> => {
  // if it's not browser/not metamask provider or we switch to default network - return true
  if (!window?.ethereum?.isMetaMask || DEFAULT_NETWORKS.includes(decChainId)) {
    return true
  }
  const chainId = `0x${decChainId.toString(16)}`
  const metamaskNetwork: MetamaskNetwork = {
    chainId,
    chainName,
    rpcUrls,
    blockExplorerUrls: [blockExplorer],
  }
  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [metamaskNetwork],
  })
  return true
}
