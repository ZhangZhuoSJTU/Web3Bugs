require("dotenv").config();
/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

const HDWalletProvider = require("@truffle/hdwallet-provider");

const RINKEBY_ENDPOINT = `https://rinkeby.infura.io/v3/${process.env.INFURA_TOKEN}`;
const KOVAN_ENDPOINT = `https://kovan.infura.io/v3/${process.env.INFURA_TOKEN}`;
const GOERLI_ENDPOINT = `https://goerli.infura.io/v3/${process.env.INFURA_TOKEN}`;
const MAINNET_ENDPOINT = `https://mainnet.infura.io/v3/${process.env.INFURA_TOKEN}`;
const POLYGON_ENDPOINT = `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_TOKEN}`;
const MUMBAI_ENDPOINT = `https://polygon-mumbai.infura.io/v3/${process.env.INFURA_TOKEN}`;

const PRIVATE_KEY_1 = process.env.PRIVATE_KEY_1
  ? `0x${process.env.PRIVATE_KEY_1}`
  : "0x64fba59162e4f093b7503016a580a24c5f46b68a72939c65daeb211241936cc8";

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    rinkeby: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, RINKEBY_ENDPOINT),
      // eslint-disable-next-line camelcase
      network_id: 4,
      skipDryRun: false,
      gasPrice: 100000000000, // 100 gwei
      gas: 7000000,
    },
    kovan: {
      provider: () => new HDWalletProvider(PRIVATE_KEY_1, KOVAN_ENDPOINT),
      // eslint-disable-next-line camelcase
      network_id: 42,
      skipDryRun: false,
      gasPrice: 50000000000, // 50 gwei
      gas: 12000000,
    },
    goerli: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, GOERLI_ENDPOINT),
      // eslint-disable-next-line camelcase
      network_id: 5,
      skipDryRun: false,
    },
    mainnet: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, MAINNET_ENDPOINT),
      // eslint-disable-next-line camelcase
      network_id: 1,
      skipDryRun: false,
      gasPrice: 0, // 0 gwei
      gas: 1000000, // 1m
    },
    mumbai: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, MUMBAI_ENDPOINT),
      // eslint-disable-next-line camelcase
      network_id: 80001,
      // Confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      gasPrice: 1000000000, // 1 gwei
      gas: 12000000,
    },
    polygon: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, POLYGON_ENDPOINT),
      // eslint-disable-next-line camelcase
      network_id: 137,
      // Confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      gasPrice: 5000000000, // 5 gwei
      gas: 12000000,
    },
    develop: {
      // eslint-disable-next-line camelcase
      network_id: 1,
      host: "127.0.0.1",
      port: 8545,
      from: "0xcc8793d5eB95fAa707ea4155e09b2D3F44F33D1E", // Multisig account
      skipDryRun: false,
      gasPrice: 50000000000, // 50 gwei
      gas: 9000000, // 9m
    },
    developPolygon: {
      // eslint-disable-next-line camelcase
      network_id: 137,
      host: "127.0.0.1",
      port: 8545,
      from: "0xbB60ADbe38B4e6ab7fb0f9546C2C1b665B86af11", // Multisig account
      skipDryRun: false,
      gasPrice: 50000000000, // 50 gwei
      gas: 9000000, // 9m
    },
    developFantom: {
      // eslint-disable-next-line camelcase
      network_id: 250,
      host: "127.0.0.1",
      port: 8545,
      from: "0x1F1eC8d78cD802072C7a24ea8c2Dd4dcB1C4C242", // Multisig account
      skipDryRun: false,
      gasPrice: 50000000000, // 50 gwei
      gas: 12000000, // 12m
    },
  },

  plugins: ["solidity-coverage", "truffle-plugin-verify", "truffle-contract-size"],

  // eslint-disable-next-line camelcase
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY,
    polygonscan: process.env.POLYGONSCAN_API_KEY,
    ftmscan: process.env.FTMSCAN_API_KEY,
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // Timeout: 100000
    // reporter: 'eth-gas-reporter',
    // reporterOptions : {
    //   onlyCalledMethods: false,
    //   showMethodSig: true
    // } // https://github.com/cgewecke/eth-gas-reporter#options
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.6.12", // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {
        // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200,
        },
        //  EvmVersion: "byzantium"
      },
    },
  },
};
