import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-web3"
import "@typechain/hardhat"
import "@nomiclabs/hardhat-waffle"
import "hardhat-gas-reporter"
import "@nomiclabs/hardhat-etherscan"
import "hardhat-abi-exporter"

// deployment plugins
import "hardhat-deploy"
import "@nomiclabs/hardhat-ethers"

import "solidity-coverage"

import {HardhatUserConfig} from "hardhat/types/config"

const PRIVATE_KEY = process.env.PRIVATE_KEY
const INFURA_KEY = process.env.INFURA_KEY

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.5.11",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            }
        ]
    },
    namedAccounts: {
        deployer: 0
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            gas: 12000000,
            allowUnlimitedContractSize: true,
            blockGasLimit: 12000000,
            accounts: {
                count: 250
            }
        },
        mainnet: {
            url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
            accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : undefined
        },
        rinkeby: {
            url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
            accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : undefined,
            blockGasLimit: 12000000
        },
        localhost: {
            url: "http://127.0.0.1:8545"
        }
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS ? true : false
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY
    },
    abiExporter: {
        path: "./abi",
        clear: true,
        flat: true
    }
}

export default config
