// When running CI, we connect to the hardhat node container
const testHost = process.env.CI === 'true' ? 'eth-node' : '127.0.0.1'

// URL value are public defaults. You should probably replace with your own providers...
module.exports = {
  mainnet: {
    chainId: 1,
    name: 'mainnet',
    url: 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
  ropsten: {
    chainId: 3,
    name: 'ropsten',
    url: 'https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
  rinkeby: {
    chainId: 4,
    name: 'rinkeby',
    url: 'https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
  kovan: {
    chainId: 42,
    name: 'kovan',
    url: 'https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
  xdai: {
    chainId: 100,
    name: 'xdai',
    url: 'https://rpc.xdaichain.com/',
  },
  polygon: {
    chainId: 137,
    name: 'polygon',
    url: 'https://rpc-mainnet.maticvigil.com/',
  },
  ganache: {
    chainId: 1337,
    url: `http://${testHost}:8545`,
    name: 'ganache',
  },
  localhost: {
    chainId: 31337,
    url: `http://${testHost}:8545`,
    name: 'localhost',
  },
  arbitrum: {
    chainId: 42161,
    url: 'https://arb1.arbitrum.io/rpc',
    name: 'arbitrum',
  },
  binance: {
    chainId: 56,
    url: 'https://bsc-dataseed.binance.org/',
    name: 'binance',
  },
}
