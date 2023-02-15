require("dotenv").config();

const path = require("path");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const INFURA_KEY = process.env.INFURA_KEY;
const MNEMONIC = process.env.MNEMONIC;
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;
const blockchainNodeHost = process.env.BLOCKCHAIN_NODE_HOST || "localhost";
const MATIC_RPC = process.env.MATIC_RPC || "https://rpc-mainnet.maticvigil.com";
const MUMBAI_RPC = process.env.MUMBAI_RPC || "https://rpc-mumbai.maticvigil.com";
const MATIC_KEY = process.env.MATIC_KEY;

module.exports = {
  plugins: ["truffle-plugin-verify", 'truffle-contract-size'],
  contracts_build_directory: path.join(__dirname, "./artifactsTruffle"),
  networks: {
    develop: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    graphTesting: {
      host: blockchainNodeHost, // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      gasPrice: 1000000000, // 1 gwei
    },
    mainnet: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://mainnet.infura.io/v3/${INFURA_KEY}`
        );
      },
      network_id: 1,
      gas: 12000000,
      gasPrice: 50000000000,
      networkCheckTimeout: 12000,
    },
    ropsten: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://ropsten.infura.io/v3/${INFURA_KEY}`
        );
      },
      network_id: 3,
      gas: 15000000,
    },
    rinkeby: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://rinkeby.infura.io/v3/${INFURA_KEY}`
        );
      },
      network_id: 4,
      gas: 15000000,
    },
    goerli: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://goerli.infura.io/v3/${INFURA_KEY}`
        );
      },
      network_id: 5,
      gas: 15000000,
    },
    kovan: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://kovan.infura.io/v3/${INFURA_KEY}`
        );
      },
      network_id: 42,
      gas: 10000000,
      gasPrice: 1000000000, // 1 gwei
      networkCheckTimeout: 5000,
    },
    xdai: {
      provider: function () {
        return new HDWalletProvider(MNEMONIC, "http://rpc.xdaichain.com");
      },
      network_id: 100,
      gas: 12000000,
      gasPrice: 1000000000,
    },
    matic: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`
        );
      },
      network_id: 137,
      gas: 6000000,
      gasPrice: 7500000000,
      networkCheckTimeout: 1000000,
      timeoutBlocks: 200
    },
    matic2: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://rpc-mainnet.maticvigil.com/v1/${MATIC_KEY}`
        );
      },
      network_id: 137,
      gas: 6000000,
      gasPrice: 7500000000,
      networkCheckTimeout: 1000000,
      timeoutBlocks: 200
    },
    mumbai: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://polygon-mumbai.infura.io/v3/${INFURA_KEY}`
        );
      },
      network_id: 80001,
      gas: 12000000,
      gasPrice: 5000000000,
    },
    // stage1: {
    //   provider: function () {
    //     return new HDWalletProvider(MNEMONIC, "http://rpc.xdaichain.com");
    //   },
    //   network_id: 100,
    //   gas: 12000000,
    //   gasPrice: 1000000000,
    // },
    // stage2: {
    //   provider: () => {
    //     return new HDWalletProvider(
    //       MNEMONIC,
    //       `https://mainnet.infura.io/v3/${INFURA_KEY}`
    //     );
    //   },
    //   network_id: 1,
    //   gas: 3000000,
    //   gasPrice: 140000000000,
    //   networkCheckTimeout: 12000,
    // },
    // stage3: {
    //   provider: function () {
    //     return new HDWalletProvider(MNEMONIC, "http://rpc.xdaichain.com");
    //   },
    //   network_id: 100,
    //   gas: 12000000,
    //   gasPrice: 1000000000,
    // },
    teststage1: {
      provider: function () {
        return new HDWalletProvider(MNEMONIC, MUMBAI_RPC);
      },
      network_id: 80001,
      gas: 12000000,
      gasPrice: 5000000000,
    },
    teststage2: {
      provider: () => {
        return new HDWalletProvider(
          MNEMONIC,
          `https://goerli.infura.io/v3/${INFURA_KEY}`
        );
      },
      network_id: 5,
      gas: 15000000,
    },
    teststage3: {
      provider: function () {
        return new HDWalletProvider(MNEMONIC, MUMBAI_RPC);
      },
      network_id: 80001,
      gas: 12000000,
      gasPrice: 5000000000,
    },

  },
  compilers: {
    solc: {
      version: "0.8.7",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
  api_keys: {
    etherscan: ETHERSCAN_KEY,
  },
  verify: {
    preamble: `Created by Andrew Stanger
    ██████╗ ███████╗ █████╗ ██╗     ██╗████████╗██╗   ██╗ ██████╗ █████╗ ██████╗ ██████╗ ███████╗
    ██╔══██╗██╔════╝██╔══██╗██║     ██║╚══██╔══╝╚██╗ ██╔╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔════╝
    ██████╔╝█████╗  ███████║██║     ██║   ██║    ╚████╔╝ ██║     ███████║██████╔╝██║  ██║███████╗
    ██╔══██╗██╔══╝  ██╔══██║██║     ██║   ██║     ╚██╔╝  ██║     ██╔══██║██╔══██╗██║  ██║╚════██║
    ██║  ██║███████╗██║  ██║███████╗██║   ██║      ██║   ╚██████╗██║  ██║██║  ██║██████╔╝███████║
    ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝      ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝`,
  },
};