/* eslint-disable node/no-unsupported-features/es-syntax */
require("dotenv").config();

require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");

const accounts =
  process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [];

const createInfuraEntry = (
  networkName,
  chainId,
  gas = "auto",
  gasPrice = "auto"
) => ({
  [networkName]: {
    url: `https://${networkName}.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
    accounts,
    chainId,
    gas,
    gasPrice,
  },
});

module.exports = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: [
    ["mainnet", 1],
    ["rinkeby", 4],
  ].reduce(
    (value, chain) => ({
      ...value,
      ...createInfuraEntry(...chain),
    }),
    {}
  ),
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "ETHERSCAN_API_KEY",
  },
};
