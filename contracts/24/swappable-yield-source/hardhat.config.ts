import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-abi-exporter';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import 'hardhat-dependency-compiler';

import { HardhatUserConfig } from 'hardhat/config';

import * as forkTasks from './scripts/fork';
import * as prizePoolTasks from './scripts/createAndRunPrizePoolMainnet';
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
    gasPrice: 15,
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
    genericProxyFactory: {
      default: '0x14e09c3319244a84e7c1E7B52634f5220FA96623',
      4: '0x594069c560D260F90C21Be25fD2C8684efbb5628',
      42: '0x713edC7728C4F0BCc135D48fF96282444d77E604',
      137: '0xd1797D46C3E825fce5215a0259D3426a5c49455C',
      80001: '0xd1797D46C3E825fce5215a0259D3426a5c49455C',
    },
    multisig: {
      1: '0x42cd8312D2BCe04277dD5161832460e95b24262E',
      137: '0xfD54F172c162072BAAb2d20DcC8E530736a269a7',
    },
  },
  networks,
  solidity: {
    version: '0.7.6',
    settings: {
      optimizer: {
        enabled: optimizerEnabled,
        runs: 200,
      },
      evmVersion: 'berlin',
    },
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v5',
  },
  dependencyCompiler: {
    paths: ['@pooltogether/pooltogether-proxy-factory/contracts/GenericProxyFactory.sol'],
  },
};

forkTasks;
prizePoolTasks;

export default config;
