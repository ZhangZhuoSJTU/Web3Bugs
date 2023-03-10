require("dotenv").config();
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import '@openzeppelin/hardhat-upgrades';

import { HardhatUserConfig } from "hardhat/types";

import "./tasks/deploy"

const {
  PRIVATE_KEY,
  INFURA_PROJECT_ID,
  ETHERSCAN_KEY,
} = process.env;

export default {
  etherscan: {
    apiKey: ETHERSCAN_KEY,
    // apiKey: POLYSCAN_KEY,
  },
  mocha: {
    timeout: 300000,
  },
  networks: {
    hardhat: {
      blockGasLimit: 200000000,
      gasLimit: 200000000,
      chainId: 137,
      initialBaseFeePerGas: 0
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      network_id: 1,
      timeout: 200000000,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [PRIVATE_KEY || ""],
    },
    matic: {
      url: `https://polygon-mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      chainId: 137,
      accounts: [PRIVATE_KEY || ""],
    },
    mumbai: {
      url: `https://matic-mumbai.chainstacklabs.com`,
      chainId: 80001,
      accounts: [PRIVATE_KEY || ""],
    },
  },
  solidity: {
    version: "0.8.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v5",
    externalArtifacts: ["externalArtifacts/*.json"], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
  },
} as HardhatUserConfig;
