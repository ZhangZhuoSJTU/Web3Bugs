require("dotenv").config();

import { HardhatUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@typechain/hardhat";

// tasks
import "./tasks/";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
        blockNumber: 12638355, //this makes ti faster
      },
      blockGasLimit: 10000000,
    },
    localhost: {
      timeout: 30000000,
      url: 'http://localhost:8545',
      accounts: [process.env.PRIVATE_KEY || ''],
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY || ""],
      gasPrice: 48 * 1000000000, //70 gwei
      timeout: 2000 * 1000, //20 min
    },
    matic: {
      chainId: 137,
      timeout: 20000000,
      url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY || '']
    },
    mumbai: {
      url: `https://polygon-mumbai.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      chainId: 80001,
      accounts: [process.env.PRIVATE_KEY || '']
    },

  },
  solidity: {
    version: "0.7.5",
    settings: {
      optimizer: {
        // Factory goes above contract size limit
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    target: "ethers-v5",
  },
  etherscan: { apiKey: process.env.ETHERSCAN_KEY },
};




export default config;
