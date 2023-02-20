require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");


module.exports = {
  solidity: {
    version: "0.8.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100000,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      },
    },
  },
  gasReporter: {},
};