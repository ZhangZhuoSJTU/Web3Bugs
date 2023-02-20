import * as dotenv from 'dotenv';

import {HardhatUserConfig, task} from 'hardhat/config';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

// deployment plugins
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';

dotenv.config();

task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.4',
    settings: {
      outputSelection: {
        '*': {
          '*': ['storageLayout'],
        },
      },
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      blockGasLimit: 12000000,
      accounts: {
        count: 20,
      },
    },
    localhostl1: {
      url: 'http://localhost:8545',
      companionNetworks: {
        l2: 'localhostl2',
      },
    },
    localhostl2: {
      url: 'http://localhost:8546',
      companionNetworks: {
        l1: 'localhostl1',
      },
    },
    rinkeby: {
      url: process.env.RINKEBY_URL || '',
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      companionNetworks: {
        l2: 'arbitrumRinkeby',
      },
    },
    arbitrumLocal: {
      url: 'http://localhost:8547',
      accounts: {
        mnemonic:
          'jar deny prosper gasp flush glass core corn alarm treat leg smart',
        path: 'm/44\'/60\'/0\'/0',
        initialIndex: 0,
        count: 10,
      },
      gasPrice: 0,
    },
    arbitrumRinkeby: {
      url: process.env.ARB_RINKEBY_URL || '',
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      companionNetworks: {
        l1: 'rinkeby',
      },
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
