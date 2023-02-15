import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-abi-exporter';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import 'hardhat-dependency-compiler';
import 'hardhat-log-remover';
import 'solidity-coverage';

import { HardhatUserConfig } from 'hardhat/config';

import * as forkTasks from './scripts/fork';
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
            '@pooltogether/v4-core/contracts/Ticket.sol',
            '@pooltogether/v4-core/contracts/PrizeDistributionBuffer.sol',
            '@pooltogether/v4-core/contracts/prize-pool/YieldSourcePrizePool.sol',
            '@pooltogether/v4-core/contracts/prize-strategy/PrizeSplitStrategy.sol',
            '@pooltogether/v4-core/contracts/interfaces/IReserve.sol',
            '@pooltogether/v4-core/contracts/interfaces/IStrategy.sol',
            '@pooltogether/v4-core/contracts/interfaces/IPrizeDistributionSource.sol',
            '@pooltogether/v4-core/contracts/interfaces/IPrizeDistributionBuffer.sol',
            '@pooltogether/v4-core/contracts/test/ERC20Mintable.sol',
            '@pooltogether/v4-core/contracts/test/ReserveHarness.sol',
            '@pooltogether/v4-core/contracts/test/TicketHarness.sol',
        ],
    },
    external: {
        contracts: [
            {
                artifacts:
                    'node_modules/@pooltogether/aave-yield-source/artifacts/contracts/yield-source/ATokenYieldSource.sol/',
            },
            {
                artifacts: 'node_modules/@pooltogether/v4-core/artifacts/contracts/',
            },
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
    typechain: {
        outDir: './types',
        target: 'ethers-v5',
    },
};

forkTasks;

export default config;
