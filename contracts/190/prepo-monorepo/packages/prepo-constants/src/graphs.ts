import { SupportedNetworks } from './networks'

export type SupportedGraphs = 'core' | 'uniswapV3'

export type GraphEndpoint = {
  [key in SupportedNetworks]?: string
}

export type GraphEndpoints = {
  [key in SupportedGraphs]: GraphEndpoint
}

export const GRAPH_ENDPOINTS: GraphEndpoints = {
  core: {
    mainnet: 'https://api.thegraph.com/subgraphs/name/chrisling-dev/prepo-goerli-staging',
    goerli: 'https://api.thegraph.com/subgraphs/name/chrisling-dev/prepo-goerli-staging',
  },
  uniswapV3: {
    mainnet: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
    goerli: 'https://api.thegraph.com/subgraphs/name/liqwiz/uniswap-v3-goerli',
  },
}
