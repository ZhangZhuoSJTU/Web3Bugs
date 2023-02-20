import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-abi-exporter';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import 'hardhat-log-remover';
import 'solidity-coverage';
import 'hardhat-dependency-compiler';
import './hardhat/tsunami-tasks.js';
import { HardhatUserConfig } from 'hardhat/config';
import networks from './hardhat.network';

const optimizerEnabled = !process.env.OPTIMIZER_DISABLED;

const config: HardhatUserConfig = {
    abiExporter: {
        path: './abis',
        clear: true,
        flat: true,
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    gasReporter: {
        currency: 'USD',
        gasPrice: 100,
        enabled: process.env.REPORT_GAS ? true : false,
    },
    mocha: {
        timeout: 30000,
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        testnetCDai: {
            // 1: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
            4: '0x6D7F0754FFeb405d23C51CE938289d4835bE3b14',
            42: '0xF0d0EB522cfa50B716B3b1604C4F0fA6f04376AD',
        },
    },
    networks,
    solidity: {
        compilers: [
            {
                version: '0.8.6',
                settings: {
                    optimizer: {
                        enabled: optimizerEnabled,
                        runs: 2000,
                    },
                    evmVersion: 'berlin',
                },
            },
            {
                version: '0.7.6',
                settings: {
                    optimizer: {
                        enabled: optimizerEnabled,
                        runs: 2000,
                    },
                    evmVersion: 'berlin',
                },
            },
        ],
    },
    external: {
        contracts: [
            {
                artifacts: 'node_modules/@pooltogether/pooltogether-rng-contracts/build',
            },
        ],
    },
    dependencyCompiler: {
        paths: [
            '@pooltogether/yield-source-interface/contracts/test/MockYieldSource.sol',
        ],
    },
};

export default config;
