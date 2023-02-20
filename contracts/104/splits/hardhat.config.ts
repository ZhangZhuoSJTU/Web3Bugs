import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-solhint';
import 'hardhat-typechain';
import "@nomiclabs/hardhat-etherscan";

import * as dotenv from 'dotenv';
dotenv.config();

const alchemyAPIKey = process.env.ALCHEMY_API_KEY;
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 2000
      }
    }
  },
  typechain: {
    outDir: 'ts-types/contracts',
    target: 'ethers-v5'
  },
  networks: {
    rinkeby: {
      url: `http://eth-rinkeby.alchemyapi.io/v2/${alchemyAPIKey}`,
      accounts: [deployerPrivateKey],
    },
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${alchemyAPIKey}`,
      accounts: [deployerPrivateKey],
    },
    polygonMumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${alchemyAPIKey}`,
      accounts: [deployerPrivateKey],
    },
  },
  etherscan: {
    apiKey: {
        mainnet: "YOUR_ETHERSCAN_API_KEY",
        ropsten: "YOUR_ETHERSCAN_API_KEY",
        rinkeby: "YOUR_ETHERSCAN_API_KEY",
        goerli: "YOUR_ETHERSCAN_API_KEY",
        kovan: "YOUR_ETHERSCAN_API_KEY",
       
        // polygon
        polygon: "5GT5IQNDSN2FNJ56KSZNXJ97B3E7Z4K4GW",
        polygonMumbai: "5GT5IQNDSN2FNJ56KSZNXJ97B3E7Z4K4GW",
    }
  }
};

export default config;