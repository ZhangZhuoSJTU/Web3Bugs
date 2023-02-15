import dotenv from 'dotenv';
import { task, HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-typechain";
import "solidity-coverage";
import "hardhat-gas-reporter";
import "hardhat-log-remover";
import "hardhat-contract-sizer";
import "@tenderly/hardhat-tenderly";
import { use } from "chai";
import { near, withinPercent } from "./test/assertions";

use(near);
use(withinPercent);

const result = dotenv.config()

if (result.error) {
  throw result.error;
}

// Imported after dotenv incase any of these need env variables
import './tasks/index';

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    version: "0.6.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    }
  },
  typechain: {
    outDir: './type',
    target: 'ethers-v5'
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    },
    localhost: {
      url: "http://localhost:8545",
    },

    // Mainnets
    matic: {
      url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: {
        mnemonic: process.env.MALT_DEPLOY_SEED,
      }
    },
    bsc: {
      url: `https://bsc-dataseed.binance.org/`,
      accounts: {
        mnemonic: process.env.MALT_DEPLOY_SEED,
      }
    },
    fantom: {
      url: `https://rpcapi.fantom.network`,
      accounts: {
        mnemonic: process.env.MALT_DEPLOY_SEED,
      }
    },
    eth: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts: {
        mnemonic: process.env.MALT_DEPLOY_SEED,
      }
    },

    // Testnets
    goerli: {
      // url: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: {
        mnemonic: process.env.MALT_TESTNET_DEPLOY_SEED,
      }
    },
    avaxtestnet: {
      url: `https://api.avax-test.network/ext/bc/C/rpc`,
      accounts: {
        mnemonic: process.env.MALT_TESTNET_DEPLOY_SEED,
      }
    },
    bsctestnet: {
      url: `https://data-seed-prebsc-1-s1.binance.org:8545/`,
      accounts: {
        mnemonic: process.env.MALT_TESTNET_DEPLOY_SEED,
      }
    },
    matictestnet: {
      // url: `https://polygon-mumbai.infura.io/v3/${process.env.INFURA_KEY}`,
      url: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
      accounts: {
        mnemonic: process.env.MALT_TESTNET_DEPLOY_SEED,
      }
    },
    fantomtestnet: {
      url: `https://rpc.testnet.fantom.network/`,
      accounts: {
        mnemonic: process.env.MALT_TESTNET_DEPLOY_SEED,
      }
    },
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 150,
    enabled: (process.env.REPORT_GAS) ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_KEY,
  }
}

export default config;
