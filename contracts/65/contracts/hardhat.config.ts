import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import 'dotenv/config';
import {HardhatUserConfig} from 'hardhat/types';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import 'hardhat-contract-sizer';

const privateKey = process.env.DEV1_PRIVATE_KEY;
const INFURA_ID = process.env.INFURA_ID;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // forking: {
      //   url: "https://mainnet.infura.io/v3/" + INFURA_ID,
      // }
    },
    localhost: {
      url: "http://localhost:8545",
    },
    // rinkeby: {
    //   url: "https://rinkeby.infura.io/v3/" + INFURA_ID,
    //   accounts: [`${privateKey}`]
    // },
    // mainnet: {
    //   url: "https://mainnet.infura.io/v3/" + INFURA_ID,
    //   accounts: [`${privateKey}`],
    //   gasPrice: 90000000000
    // },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.7",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1
          }
        }
      },    
    ]
  },
  mocha: {
    timeout: 0,
  },
  paths: {
    sources: "./contracts",
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  }
};

export default config;