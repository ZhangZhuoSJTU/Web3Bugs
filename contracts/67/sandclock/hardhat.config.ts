import type { HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@primitivefi/hardhat-dodoc";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";

const devMnemonic =
  process.env.MNEMONIC ||
  "core tornado motion pigeon kiss dish differ asthma much ritual black foil";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: devMnemonic,
        accountsBalance: "100000000000000000000000000",
      },
      initialBaseFeePerGas: 0,
    },
    docker: {
      url: "http://localhost:8545",
      accounts: {
        mnemonic: devMnemonic,
      },
      chainId: 1337,
      live: false,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${
        process.env.INFURA_KEY || "missing-key"
      }`,
      chainId: 1,
      accounts: {
        mnemonic: process.env.MAINNET_MNEMONIC || "TODO",
      },
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${
        process.env.INFURA_KEY || "missing-key"
      }`,
      chainId: 4,
      accounts: {
        mnemonic: process.env.TESTNET_MNEMONIC || "TODO",
      },
    },
  },
  namedAccounts: {
    deployer: 0,
    alice: 1,
    bob: 2,
    carol: 3,
  },
  mocha: {
    timeout: 2000000,
  },
  typechain: {
    outDir: "typechain",
  },
  dodoc: {
    runOnCompile: !!process.env.COMPILE_DOCS || false,
    include: [
      "Vault",
      "Claimers",
      "Depositors",
      "IVault",
      "IIntegration",
      "IDCA",
      "DCAQueue",
      "DCAScheduler",
      "DCAUniswapV3",
      "PercentMath",
    ],
  },
};

export default config;
