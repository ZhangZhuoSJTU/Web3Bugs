
import "@nomiclabs/hardhat-ethers";
import '@typechain/hardhat'

const config = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      gasPrice: 0,
      blockGasLimit: 100000000,
    },
    localhost: {
      url: 'http://localhost:8545'
    },


  },
  solidity: {
    version: '0.7.5',
    settings: {
      optimizer: {
        // PieFactory pushes contract size over limit. Consider reducing factory size
        enabled: true,
        runs: 200
      }
    }
  },
  typechain: {
    target: 'ethers-v5'
  },
}

export default config;