import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import "@nomiclabs/hardhat-waffle"

import "hardhat-watcher"
import "hardhat-gas-reporter"

const config = {
  solidity: {
    compilers: [
      {
        version: "0.8.0",
      },
      {
        version: "0.6.11",
      },
      {
        version: "0.5.17",
      },
    ],
  },
  typechain: {
    target: "ethers-v5",
  },
  watcher: {
    test: {
      tasks: ["test"],
      files: ["./contracts", "./test"],
    },
  },
}

export default config
