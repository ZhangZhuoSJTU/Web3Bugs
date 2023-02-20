require("@nomiclabs/hardhat-waffle");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("hardhat-deploy");
require("solidity-coverage");

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const GOERLI_PRIVATE_KEY = "YOUR_PRIVATE_KEY";
const GOERLI_ALCHEMY_API_KEY = "YOUR_API_KEY"

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100000,
      },
    },
  },
  networks: {
    hardhat: {
      deploy: ["deploy/core", "deploy/test", "deploy/testnet"],
    },
    // goerli: {
    //   deploy: ["deploy/core", "deploy/testnet"],
    //   url: `https://eth-goerli.alchemyapi.io/v2/${GOERLI_ALCHEMY_API_KEY}`,
    //   accounts: [`0x${GOERLI_PRIVATE_KEY}`]
    // },
  },
  paths: {
    deploy: ["deploy/core"],
    sources: "./src",
  },
  namedAccounts: {
    admin: {
      default: 0,
      "goerli": "0x5fD46DbFCebA8EB28485fF7733FC7c00Ca861d7c"
    },
    liquidityProvider1: {
      default: 1,
    },
    liquidityProvider2: {
      default: 2,
    },
    trader1: {
      default: 3,
    },
    trader2: {
      default: 4,
    },
    feeRecipient: {
      default: 5,
      "goerli": "0x5B68bE5a991eE3bc944819073Da0d1dD27912093"
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
};
