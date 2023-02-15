interface WormholeConfig {
  [key: string]: {
    wormholeRouter: string
  }
}

const config: WormholeConfig = {
  // leave anyswapRouter as '' if you want to deploy a router with deployments
  hardhat: {
    wormholeRouter: '',
  },
  mainnet: {
    wormholeRouter: '0x3ee18B2214AFF97000D974cf647E7C347E8fa585',
  },
  rinkeby: {
    wormholeRouter: '-',
  },
  ropsten: {
    wormholeRouter: '-',
  },
  goerli: {
    wormholeRouter: '-',
  },
  polygon: {
    wormholeRouter: '0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE',
  },
  xdai: {
    wormholeRouter: '-',
  },
  bsc: {
    wormholeRouter: '0xB6F6D86a8f9879A9c87f643768d9efc38c1Da6E7',
  },
  fantom: {
    wormholeRouter: '-',
  },
  mumbai: {
    wormholeRouter: '-',
  },
  arbitrum_rinkeby: {
    wormholeRouter: '-',
  },
  avax: {
    wormholeRouter: '0x0e082F06FF657D94310cB8cE8B0D9a04541d8052',
  },
}

export default config
