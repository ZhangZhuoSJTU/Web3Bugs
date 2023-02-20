import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import * as dotenv from 'dotenv'
import 'hardhat-contract-sizer'
import "hardhat-gas-reporter"
import { HardhatUserConfig } from 'hardhat/types'
import 'solidity-coverage'

dotenv.config()

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID
const RINKEBY_PRIVATE_KEY = process.env.PRIVATE_KEY

const config= {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      accounts: { accountsBalance: (1n << 256n).toString() },
      gas: 120000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      timeout: 1800000
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${RINKEBY_PRIVATE_KEY}`],
    },
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
    alwaysGenerateOverloads: true,
  },
  
  allowUnlimitedContractSize: true
  // contractSizer: {
  //   alphaSort: true,
  //   runOnCompile: true,
  //   disambiguatePaths: false,
  // },
}

export default config
