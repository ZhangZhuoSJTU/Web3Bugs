require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-ethers")
require("hardhat-contract-sizer")
require("hardhat-deploy")
require("hardhat-abi-exporter")
require("hardhat-typechain")
require("@nomiclabs/hardhat-etherscan")
require("solidity-coverage")
require("hardhat-gas-reporter")

const mnemonic = ""

module.exports = {
    solidity: {
        version: "0.8.0",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000,
            },
            outputSelection: {
                "*": {
                    "*": ["storageLayout"],
                },
            },
        },
    },
    networks: {
        hardhat: {
            blockGasLimit: 12450000,
        },
        arbitrum: {
            url: "https://kovan5.arbitrum.io/rpc",
            gasPrice: 0,
            accounts: { mnemonic: mnemonic },
        },
        kovan: {
            url: "KOVAN_URL",
            gasPrice: 3000000000, //3 gwei
            accounts: { mnemonic: mnemonic },
        },
        local: {
            url: "http://localhost:8545",
        },
    },
    namedAccounts: {
        deployer: 0,
        acc1: 1,
        acc2: 2,
        acc3: 3,
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: true,
        disambiguatePaths: false,
    },
    typechain: {
        outDir: "./types",
        target: "web3-v1",
    },
    etherscan: {
        // Your API key for Etherscan
        // Obtain one at https://etherscan.io/
        apiKey: "API_KEY",
    },
    gasReporter: {
        currency: "AUD",
        coinmarketcap: "49e42c5c-1288-4e17-8c27-cd1a0aba014d",
    },
}
