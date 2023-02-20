import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import "hardhat-contract-sizer";

dotenv.config();

const POLYGON_ENDPOINT = `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 3000,
          },
        },
      },
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 3000,
          },
        },
      },
      {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 3000,
          },
        },
      },
    ],
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      loggingEnabled: true,
    },
    hardhat: {},
    polygon: {
      url: POLYGON_ENDPOINT,
      chainId: 137,
      accounts: process.env.PRIVATE_KEY === undefined ? [] : [process.env.PRIVATE_KEY],
      verify: {
        etherscan: {
          apiUrl: "https://api.polygonscan.com",
        },
      },
    },
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 1000000,
  },
  namedAccounts: {
    owner: {
      default: 0,
    },
    user: {
      default: 1,
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY,
    },
  },
};

export default config;
