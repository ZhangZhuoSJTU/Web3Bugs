interface AnyswapConfig {
  [key: string]: {
    anyswapRouter: string
  }
}

const config: AnyswapConfig = {
  // leave anyswapRouter as '' if you want to deploy a router with deployments
  hardhat: {
    anyswapRouter: '',
  },
  // Anyswap v4 router
  mainnet: {
    anyswapRouter: '0x6b7a87899490EcE95443e979cA9485CBE7E71522',
  },
  rinkeby: {
    anyswapRouter: '-',
  },
  ropsten: {
    anyswapRouter: '-',
  },
  goerli: {
    anyswapRouter: '-',
  },
  polygon: {
    anyswapRouter: '-',
  },
  xdai: {
    anyswapRouter: '-',
  },
  bsc: {
    anyswapRouter: '-',
  },
  fantom: {
    anyswapRouter: '-',
  },
  mumbai: {
    anyswapRouter: '-',
  },
  arbitrum_rinkeby: {
    anyswapRouter: '-',
  },
}

export default config
