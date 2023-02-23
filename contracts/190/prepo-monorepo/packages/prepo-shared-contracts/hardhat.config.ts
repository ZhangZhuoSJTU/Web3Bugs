import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan'
import '@nomicfoundation/hardhat-chai-matchers'
import '@openzeppelin/hardhat-upgrades'
import '@typechain/ethers-v5'
import '@typechain/hardhat'
import { generateHardhatConfig, generateHardhatLocalConfig } from 'prepo-hardhat'
import { config as dotenvConfig } from 'dotenv'
import 'hardhat-contract-sizer'
import 'hardhat-deploy'
import 'hardhat-gas-reporter'
import { HardhatUserConfig, subtask } from 'hardhat/config'
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from 'hardhat/builtin-tasks/task-names'
import { resolve } from 'path'
import 'solidity-coverage'

dotenvConfig({ path: resolve(__dirname, './.env') })

const hardhatLocalConfig = generateHardhatLocalConfig()
const hardhatConfig = generateHardhatConfig(hardhatLocalConfig)

subtask<{ solcVersion: string }>(
  TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD,
  // eslint-disable-next-line require-await
  async (args, hre, runSuper) => {
    console.log(process.env.LOCAL_SOLC)
    if (args.solcVersion === '0.8.7' && process.env.LOCAL_SOLC) {
      const compilerPath = resolve(__dirname, '../compiler', 'soljson-v0.8.7+commit.e28d00a7.js')

      return {
        compilerPath,
        isSolcJs: true,
        version: args.solcVersion,
      }
    }

    // we just use the default subtask if the version is not 0.8.7
    return runSuper()
  }
)

const config: HardhatUserConfig = {
  ...hardhatConfig,
  solidity: {
    compilers: [
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 99999,
          },
        },
      },
    ],
  },
  typechain: {
    outDir: 'types/generated',
    target: 'ethers-v5',
  },
  etherscan: {
    apiKey: {
      // ethereum
      mainnet: hardhatLocalConfig.ETHERSCAN_API_KEY,
      ropsten: hardhatLocalConfig.ETHERSCAN_API_KEY,
      rinkeby: hardhatLocalConfig.ETHERSCAN_API_KEY,
      goerli: hardhatLocalConfig.ETHERSCAN_API_KEY,

      // arbitrum
      arbitrumOne: hardhatLocalConfig.ARBISCAN_API_KEY,
      arbitrumTestnet: hardhatLocalConfig.ARBISCAN_API_KEY,

      // polygon
      polygon: hardhatLocalConfig.POLYGONSCAN_API_KEY,
      polygonMumbai: hardhatLocalConfig.POLYGONSCAN_API_KEY,
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
  },
}

export default config
