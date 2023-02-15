interface BiconomyConfig {
  [key: string]: {
    biconomyRouter: string
  }
}

const config: BiconomyConfig = {
  // leave anyswapRouter as '' if you want to deploy a router with deployments
  hardhat: {
    biconomyRouter: '',
  },
  mainnet: {
    biconomyRouter: '0xF78765bd14B4E8527d9E4E5c5a5c11A44ad12F47',
  },
  rinkeby: {
    biconomyRouter: '-',
  },
  ropsten: {
    biconomyRouter: '-',
  },
  goerli: {
    biconomyRouter: '0xBD435D6dB65ED030bF2eD398B311d70210D452Cd',
  },
  polygon: {
    biconomyRouter: '0xF78765bd14B4E8527d9E4E5c5a5c11A44ad12F47',
  },
  xdai: {
    biconomyRouter: '-',
  },
  bsc: {
    biconomyRouter: '-',
  },
  fantom: {
    biconomyRouter: '-',
  },
  mumbai: {
    biconomyRouter: '0xC6661f9b1B1c413639a78075ba743cFA26F8c985',
  },
  arbitrum_rinkeby: {
    biconomyRouter: '-',
  },
}

export default config
