require("@nomiclabs/hardhat-truffle5");
require("solidity-coverage");
require("hardhat-gas-reporter");
// require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;
const POLYGON_KEY = process.env.POLYGON_KEY;
const INFURA_KEY = process.env.INFURA_KEY;
const REPORT_GAS = process.env.REPORT_GAS;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.7",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  gasReporter: {
    enabled: false
  },
  paths: {
    artifacts: "./artifactsBuidler",
    tests: "./test",
  },
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
      network_id: 1,
      gas: 12000000,
      gasPrice: 50000000000,
      networkCheckTimeout: 12000,
    },
    hardhat: {
      gas: 20000000,
      blockGasLimit: 20000000,
      gasPrice: "auto",
      accounts: {
        count: 2000,
      }
    },
    matic: {
      url: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
      network_id: 137,
      gas: 6000000,
      gasPrice: 7500000000,
      networkCheckTimeout: 1000000,
      timeoutBlocks: 200
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_KEY
  }
};
