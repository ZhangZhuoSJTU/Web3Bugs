require("dotenv").config();
require('hardhat-contract-sizer');

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require('hardhat-deploy');
require('hardhat-deploy-ethers');
require('chai');
require('eth-permit');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
              enabled: true,
              runs: 1000000
          }
        }
      }
    ],
    overrides: {
      "contracts/Trading.sol":{
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10
          }
        }
      },
    }
  },
  networks: {
    hardhat: {
      blockGasLimit: 100_000_000
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    polygon: {
      url: process.env.POLYGON_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 200000000000 // 100 gwei
    },
    fantom: {
      url: process.env.FANTOM_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    avaxtest: {
      url: process.env.AVAX_TEST_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    zktest: {
      url: process.env.ZKTEST_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    ftmtest: {
      url: "https://rpc.testnet.fantom.network/",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    fuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    mumbai: {
      url: process.env.MUMBAI_URL || "",
      accounts: 
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 40000000000, // 40 gwei
      chainId: 80001
    },
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    arbgoerli: {
      url: "https://goerli-rollup.arbitrum.io/rpc",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  namedAccounts: {
    deployer: {
      250: process.env.DEPLOYER_ADDRESS,
      137: process.env.DEPLOYER_ADDRESS,
      42161: process.env.DEPLOYER_ADDRESS,
      421611: process.env.DEPLOYER_ADDRESS,
      31337: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      43113: process.env.DEPLOYER_ADDRESS,
      43114: process.env.DEPLOYER_ADDRESS,
      280: process.env.DEPLOYER_ADDRESS,
      4002: process.env.DEPLOYER_ADDRESS,
      80001: process.env.DEPLOYER_ADDRESS,
      421613: process.env.DEPLOYER_ADDRESS
    },
    node: {
      250: process.env.NODE_ADDRESS,
      137: process.env.NODE_ADDRESS,
      42161: process.env.NODE_ADDRESS,
      421611: process.env.NODE_ADDRESS,
      43113: process.env.NODE_ADDRESS,
      43114: process.env.NODE_ADDRESS,
      280: process.env.NODE_ADDRESS,
      4002: process.env.NODE_ADDRESS,
      31337: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      80001: process.env.NODE_ADDRESS,
      421613: process.env.NODE_ADDRESS,
    },
    endpoint: {
      1: "0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675",
      4: "0x79a63d6d8BBD5c6dfc774dA79bCcD948EAcb53FA",
      10: "0x3c2269811836af69497E5F486A85D7316753cf62",
      56: "0x3c2269811836af69497E5F486A85D7316753cf62",
      69: "0x72aB53a133b27Fa428ca7Dc263080807AfEc91b5",
      97: "0x6Fcb97553D41516Cb228ac03FdC8B9a0a9df04A1",
      137: "0x3c2269811836af69497E5F486A85D7316753cf62",
      250: "0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7",
      4002: "0x7dcAD72640F835B0FA36EFD3D6d3ec902C7E5acf",
      31337: "0x0000000000000000000000000000000000000000",
      42161: "0x3c2269811836af69497E5F486A85D7316753cf62",
      43113: "0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706",
      43114: "0x3c2269811836af69497E5F486A85D7316753cf62",
      80001: "0xf69186dfBa60DdB133E91E9A4B5673624293d8F8",
      421611: "0x4D747149A57923Beb89f22E6B7B97f7D8c087A00",
      421613: "0x0000000000000000000000000000000000000000"
    },
    DAI : {
      137: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
      80001: "0xC8bdDa4d0d43088A15E028DFd1EcE655c308fd13",
    },
    SALETOKEN : {
      137: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
      42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
    },
    treasury: {
      137: "0x4f7046f36B5D5282A94cB448eAdB3cdf9Ff2b051"
    }
  }
};