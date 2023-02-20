import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/ethers-v5'
import { config as dotenvConfig } from 'dotenv'
import 'hardhat-contract-sizer'
import 'hardhat-deploy'
import 'hardhat-gas-reporter'
import '@typechain/hardhat'
import '@openzeppelin/hardhat-upgrades'
import 'solidity-coverage'
import { HardhatUserConfig } from 'hardhat/config'
import { HDAccountsUserConfig, NetworkUserConfig } from 'hardhat/types'
import { resolve } from 'path'
// import './tasks/faucet'
dotenvConfig({ path: resolve(__dirname, './.env') })

// https://hardhat.org/config/

const chainIds = {
    ganache: 1337,
    goerli: 5,
    hardhat: 31337,
    kovan: 42,
    mainnet: 1,
    rinkeby: 4,
    ropsten: 3,
}

// Ensure that we have all the environment variables we need.
let mnemonic: string
if (!process.env.MNEMONIC) {
    mnemonic = 'test test test test test test test test test test test junk'
} else {
    mnemonic = process.env.MNEMONIC
}
let infuraApiKey: string
if (!process.env.INFURA_API_KEY) {
    infuraApiKey = 'test'
} else {
    infuraApiKey = process.env.INFURA_API_KEY
}
let etherscanApiKey: string
if (!process.env.ETHERSCAN_API_KEY) {
    etherscanApiKey = 'test'
} else {
    etherscanApiKey = process.env.ETHERSCAN_API_KEY
}

export const accounts: HDAccountsUserConfig = {
    count: 10,
    initialIndex: 0,
    mnemonic,
}

function createTestnetConfig(
    network: keyof typeof chainIds
): NetworkUserConfig {
    const url: string = 'https://' + network + '.infura.io/v3/' + infuraApiKey
    return {
        accounts,
        chainId: chainIds[network],
        url,
    }
}

const config: HardhatUserConfig = {
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
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            accounts,
            chainId: chainIds.hardhat,
            gas: 'auto',
        },
        goerli: createTestnetConfig('goerli'),
        kovan: createTestnetConfig('kovan'),
        rinkeby: createTestnetConfig('rinkeby'),
        ropsten: createTestnetConfig('ropsten'),
    },
    paths: {
        artifacts: './artifacts',
        cache: './cache',
        deployments: './deployments',
        sources: './contracts',
        tests: './test',
    },
    mocha: {
        timeout: 60000,
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
    typechain: {
        outDir: './typechain',
        target: 'ethers-v5',
    },
    etherscan: {
        apiKey: etherscanApiKey,
    },
    contractSizer: {
        alphaSort: true,
        disambiguatePaths: false,
        runOnCompile: false,
    },
}

export default config
