import { task } from "hardhat/config";

import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(__dirname, "./.env") });

import { HardhatUserConfig } from "hardhat/types";
import { NetworkUserConfig } from "hardhat/types";

import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-etherscan";

// const chainIds = {
//   ganache: 1337,
//   goerli: 5,
//   hardhat: 31337,
//   kovan: 42,
//   mainnet: 1,
//   rinkeby: 4,
//   ropsten: 3,
// };

// const MNEMONIC = process.env.MNEMONIC || "";
// const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
// const ALCHEMY_KEY = process.env.ALCHEMY_KEY || "";
const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const DEPLOYER_PRIVATE_KEY_RINKEBY = process.env.DEPLOYER_PRIVATE_KEY_RINKEBY || "";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

// function createTestnetConfig(network: keyof typeof chainIds): NetworkUserConfig {
//   const url: string = "https://" + network + ".infura.io/v3/" + INFURA_API_KEY;
//   return {
//     accounts: {
//       count: 10,
//       initialIndex: 0,
//       mnemonic: MNEMONIC,
//       path: "m/44'/60'/0'/0",
//     },
//     chainId: chainIds[network],
//     url,
//   };
// }

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    // coverage: {
    //   url: "http://127.0.0.1:8555",
    // },
    // mainnet: {
    //   url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
    //   chainId: 1,
    //   accounts: [`0x${DEPLOYER_PRIVATE_KEY_MAINNET}`],
    // },
    //rinkeby: {
      //url: `https://rinkeby.infura.io/v3/${INFURA_API_KEY}`,
      // url: "https://rinkeby.infura.io/v3/24d441e3175047bfb04c60e8221878c9",
      //chainId: 4,
      //accounts: [`0x${DEPLOYER_PRIVATE_KEY_RINKEBY}`],
      // accounts: ["0xcf2a6872928392175e383fc10f93c13eab0c050bd4dbd6b45201fad5bd9409b7"],
    //},
    // rinkeby: createTestnetConfig("rinkeby"),
  },
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
      // {
      //   version: "0.6.6",
      // },
    ],
  },
  paths: {
    sources: "contracts",
    artifacts: "./build/artifacts",
    cache: "./build/cache",
  },
  // etherscan: {
  //   apiKey: ETHERSCAN_API_KEY,
  // },
  gasReporter: {
    currency: "USD",
    gasPrice: 20,
    // enabled: process.env.REPORT_GAS ? true : false,
  },
  typechain: {
    outDir: "./build/typechain/",
    target: "ethers-v5",
  },
};

export default config;
