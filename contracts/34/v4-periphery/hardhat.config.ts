import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-abi-exporter';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import 'hardhat-dependency-compiler';
import 'solidity-coverage';

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
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
        maxMethodDiff: 10,
    },
    mocha: {
        timeout: 30000,
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
    networks,
    dependencyCompiler: {
        paths: [
            '@openzeppelin/contracts/token/ERC20/IERC20.sol',
            '@pooltogether/v4-core/contracts/prize-strategy/PrizeSplitStrategy.sol',
            '@pooltogether/v4-core/contracts/interfaces/IReserve.sol',
            '@pooltogether/v4-core/contracts/interfaces/IStrategy.sol',
            '@pooltogether/v4-core/contracts/test/ERC20Mintable.sol',
            '@pooltogether/v4-core/contracts/test/ReserveHarness.sol',
        ],
    },
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
};

export default config;
