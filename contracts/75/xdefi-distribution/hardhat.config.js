require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require('solidity-coverage');
const secrets = require('./.secrets.json');

module.exports = {
    solidity: {
        version: "0.8.10",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
                details: {
                    peephole: true,
                    inliner: true,
                    jumpdestRemover: true,
                    orderLiterals: true,
                    deduplicate: true,
                    cse: true,
                    constantOptimizer: true,
                    yul: true,
                    yulDetails: {
                        stackAllocation: true
                    }
                }
            },
            metadata: {
                bytecodeHash: "none"
            },
        }
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
        ropsten: {
            url: secrets.ropsten.rpc,
            accounts: {
                mnemonic: secrets.ropsten.mnemonic,
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 1,
            },
        },
        ganache: {
            url: secrets.ganache.rpc,
            accounts: {
                mnemonic: secrets.ganache.mnemonic,
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 1,
            },
        }
    },
};
