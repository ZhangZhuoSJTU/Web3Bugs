import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import 'solidity-coverage';
import 'hardhat-spdx-license-identifier';
import 'hardhat-log-remover';
import '@nomiclabs/hardhat-etherscan';
import 'dotenv/config';
import { task } from "hardhat/config";

let networkConfig: any;
let etherscanConfig: any;
if (process.env.CI === 'true') {
  networkConfig = {
    hardhat: {
      gas: 10000000,
      allowUnlimitedContractSize: true,
      timeout: 6000000,
    },
    coverage: {
      url: 'http://localhost:8555',
    },
  };
  etherscanConfig = undefined;
} else {
  networkConfig = {
    hardhat: {
      gas: 10000000,
      allowUnlimitedContractSize: true,
      timeout: 6000000,
      forking: {
        url: process.env.MAINNET_RPC_URL,
        blockNumber: Number(process.env.MAINNET_FORK_BLOCK),
      },
    },
    coverage: {
      url: 'http://localhost:8555',
    },
    rinkeby: {
      url: process.env.RINKEBY_RPC_URL,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      gasPrice: 100000000000,
    },
  };
  etherscanConfig = {
    apiKey: process.env.ETHERSCAN_API_KEY,
  };
}
export default {
  etherscan: etherscanConfig,
  contractSizer: {
    runOnCompile: false,
    disambiguatePaths: false,
  },
  spdxLicenseIdentifier: {
    runOnCompile: true,
  },
  solidity: {
    compilers: [
      {
        version: '0.8.11',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          metadata: {
            bytecodeHash: 'none',
          },
        },
      },
    ],
  },
  networks: networkConfig,
  mocha: {
    timeout: 2000000,
  },
};
