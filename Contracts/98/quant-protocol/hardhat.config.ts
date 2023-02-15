import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@tenderly/hardhat-tenderly";
import "@typechain/hardhat";
import * as dotenv from "dotenv";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-gas-reporter";
import { HardhatUserConfig } from "hardhat/config";
import "solidity-coverage";

dotenv.config();

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      accounts: {
        mnemonic:
          process.env.MNEMONIC ||
          "word soft garden squirrel this lift object foot someone boost certain provide",
      },
    },
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
      chainId: 80001,
      accounts: {
        mnemonic:
          process.env.MNEMONIC ||
          "word soft garden squirrel this lift object foot someone boost certain provide",
      },
    },

    bscTestnet: {
      url: process.env.BSC_TESTNET_URL || "",
      chainId: 97,
      accounts: {
        mnemonic:
          process.env.MNEMONIC ||
          "word soft garden squirrel this lift object foot someone boost certain provide",
      },
    },
  },
  solidity: {
    version: "0.8.12",
    settings: {
      metadata: {
        // do not include the metadata hash, since this is machine dependent
        // https://github.com/paulrberg/solidity-template/issues/31
        bytecodeHash: "none",
      },
      // You should disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
      // viaIR: true,
    },
  },

  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false,
  },

  mocha: {
    timeout: 1000000,
  },

  typechain: {
    target: "ethers-v5",
    outDir: "typechain",
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: "USD",
    coinmarketcap: process.env.CMC_API_KEY || "",
    token: process.env.GAS_TOKEN || "BNB",
    gasPriceApi:
      process.env.GAS_PRICE_API ||
      `https://api.bscscan.com/api?module=proxy&action=eth_gasPrice&apikey=${process.env.BSCSCAN_API_KEY}`,
  },

  tenderly: {
    project: process.env.ETH_NETWORK
      ? `rolla-v1-${process.env.ETH_NETWORK}`
      : "rolla-v1-hardhat",
    username: process.env.TENDERLY_USERNAME || "",
  },
};

export default config;
