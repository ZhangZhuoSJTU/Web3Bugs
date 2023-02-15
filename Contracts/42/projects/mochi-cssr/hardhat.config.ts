import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import 'solidity-coverage';
import 'hardhat-spdx-license-identifier';
import 'hardhat-abi-exporter';
import 'hardhat-gas-reporter';
import 'hardhat-contract-sizer';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-log-remover';
import '@typechain/hardhat';
import fs from 'fs';
import 'dotenv/config';
export default {
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  typechain: {
    outDir: 'src/types',
    target: 'ethers-v5',
  },
  contractSizer: {
    runOnCompile: true,
    disambiguatePaths: false,
  },
  abiExporter: {
    path: './abi',
    clear: true,
    flat: true,
  },
  spdxLicenseIdentifier: {
    runOnCompile: true,
  },
  solidity: {
    compilers: [
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          metadata: {
            // do not include the metadata hash, since this is machine dependent
            // and we want all generated code to be deterministic
            // https://docs.soliditylang.org/en/v0.8.4/metadata.html
            bytecodeHash: 'none',
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      gas: 10000000,
      accounts: {
        accountsBalance: '1000000000000000000000000',
      },
      allowUnlimitedContractSize: true,
      forking: {
        url: process.env.MAINNET_RPC_URL,
        blockNumber: Number(process.env.MAINNET_FORK_BLOCK),
      },
      timeout: 6000000,
    },
    coverage: {
      url: 'http://localhost:8555',
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      accounts: [process.env.RINKEBY_PRIVATE_KEY],
    },
    rinkeby: {
      url: process.env.RINKEBY_RPC_URL,
      accounts: [process.env.RINKEBY_PRIVATE_KEY],
    },
  },
  mocha: {
    timeout: 2000000,
  },
};
