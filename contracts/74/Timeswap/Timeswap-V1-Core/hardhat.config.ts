import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import * as dotenv from 'dotenv'
import 'hardhat-contract-sizer'
import 'hardhat-deploy'
import 'solidity-coverage'

dotenv.config()

export default {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  namedAccounts: {
    factoryDeployer: 0,
    factoryOwner: 0,
  },
  networks: {
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env['INFURA_PROJECT_ID']}`,
      accounts: [`0x${process.env['PRIVATE_KEY']}`],
    },
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
    alwaysGenerateOverloads: true,
  },
  mocha: {
    timeout: 60000,
  },
}
