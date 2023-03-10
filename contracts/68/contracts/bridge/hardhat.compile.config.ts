import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import '@openzeppelin/hardhat-upgrades';


const config = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      gasPrice: 0,
      blockGasLimit: 100000000,
    },
    localhost: {
      url: 'http://localhost:8545'
    },
    coverage: {
      url: 'http://localhost:8555'
    },
    frame: {
      url: "http://localhost:1248"
    }
  },
  solidity: {
    version: "0.8.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  typechain: {
    outDir: "types",
    target: "ethers-v5",
    externalArtifacts: ["externalArtifacts/*.json"], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
  },
}

export default config;