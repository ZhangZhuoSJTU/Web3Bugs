import "dotenv/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-solhint";
import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-gas-reporter";
import "hardhat-spdx-license-identifier";
import "hardhat-typechain";
import "hardhat-watcher";
import "solidity-coverage";
import "@tenderly/hardhat-tenderly";

import { HardhatUserConfig, task } from "hardhat/config";

import { removeConsoleLog } from "hardhat-preprocessor";

// [0] 0x525398B78D82e54D769Ea0292fef51E20B495665
// [1] 0x02042c8A7DF7703F8d236A66B324bf9F0316A23c
// const accounts = [
//   "ca18a05140a5c5cebe5c711f84b3f1124907a3c6d1835e1c99d337cc7c7b3900",
//   "ca18a05140a5c5cebe5c711f84b3f1124907a3c6d1835e1c99d337cc7c7b3901",
// ];

const accounts = {
  mnemonic:
    process.env.MNEMONIC ||
    "test test test test test test test test test test test junk",
};

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, { ethers }) => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});

task("add:admin", "Adds admin")
  .addParam("address", "New Admin")
  .setAction(async function (
    { address },
    { ethers: { getNamedSigner, getContract } }
  ) {
    const admin = await getNamedSigner("admin");

    const accessControl = await getContract("MISOAccessControl", admin);

    console.log("Adding admin...");

    await (await accessControl.addAdminRole(address)).wait();

    console.log("Admin added!");
  });

task("unlock", "Unlocks MISO").setAction(async function (
  _,
  { ethers: { getNamedSigner, getContract } }
) {
  const admin = await getNamedSigner("admin");

  const misoMarket = await getContract("MISOMarket", admin);
  const farmFactory = await getContract("MISOFarmFactory", admin);
  const misoLauncher = await getContract("MISOLauncher", admin);
  const misoTokenFactory = await getContract("MISOTokenFactory", admin);

  const marketLocked = await misoMarket.locked();
  const farmFactoryLocked = await farmFactory.locked();
  const launcherLocked = await misoLauncher.locked();
  const tokenFactoryLocked = await misoTokenFactory.locked();

  console.log("Unlocking...");

  if (marketLocked) {
    await (await misoMarket.setLocked(false)).wait();
  }
  if (farmFactoryLocked) {
    await (await farmFactory.setLocked(false)).wait();
  }
  if (launcherLocked) {
    await (await misoLauncher.setLocked(false)).wait();
  }
  if (tokenFactoryLocked) {
    await (await misoTokenFactory.setLocked(false)).wait();
  }

  console.log("Unlocked!");
});

task("lock", "Locks MISO").setAction(async function (
  _,
  { ethers: { getNamedSigner, getContract } }
) {
  const admin = await getNamedSigner("admin");

  const misoMarket = await getContract("MISOMarket", admin);
  const farmFactory = await getContract("MISOFarmFactory", admin);
  const misoLauncher = await getContract("MISOLauncher", admin);
  const misoTokenFactory = await getContract("MISOTokenFactory", admin);

  const marketLocked = await misoMarket.locked();
  const farmFactoryLocked = await farmFactory.locked();
  const launcherLocked = await misoLauncher.locked();
  const tokenFactoryLocked = await misoTokenFactory.locked();

  console.log("Locking ...");

  if (!marketLocked) {
    await (await misoMarket.setLocked(true)).wait();
  }
  if (!farmFactoryLocked) {
    await (await farmFactory.setLocked(true)).wait();
  }
  if (!launcherLocked) {
    await (await misoLauncher.setLocked(true)).wait();
  }
  if (!tokenFactoryLocked) {
    await (await misoTokenFactory.setLocked(true)).wait();
  }

  console.log("Locked!");
});

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    currency: "USD",
    enabled: process.env.REPORT_GAS === "true",
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    admin: {
      default: 1,
    },
  },
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts,
      // gasPrice: 200 * 1000000000,
      chainId: 1,
    },
    localhost: {
      live: false,
      saveDeployments: true,
      tags: ["local"],
    },
    hardhat: {
      forking: {
        enabled: process.env.FORKING === "true",
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      },
      live: false,
      saveDeployments: true,
      tags: ["test", "local"],
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts,
      chainId: 3,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 5000000000,
      blockGasLimit: 4000000,
      // gasMultiplier: 2,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts,
      chainId: 4,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 5000000000,
      gasMultiplier: 2,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts,
      chainId: 5,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 250000000000,
      gasMultiplier: 2,
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts,
      chainId: 42,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 20000000000,
      gasMultiplier: 2,
    },
    "moonbeam-testnet": {
      url: "https://rpc.testnet.moonbeam.network",
      accounts,
      chainId: 1287,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gas: 5198000,
      gasMultiplier: 2,
    },
    "arbitrum-testnet": {
      url: "https://kovan3.arbitrum.io/rpc",
      accounts,
      chainId: 79377087078960,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2,
    },
    fantom: {
      url: "https://rpcapi.fantom.network",
      accounts,
      chainId: 250,
      live: true,
      saveDeployments: true,
      gasPrice: 22000000000,
    },
    "fantom-testnet": {
      url: "https://rpc.testnet.fantom.network",
      accounts,
      chainId: 4002,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2,
    },
    matic: {
      url: "https://rpc-mainnet.maticvigil.com",
      accounts,
      chainId: 137,
      live: true,
      saveDeployments: true,
    },
    "matic-testnet": {
      url: "https://rpc-mumbai.maticvigil.com/",
      accounts,
      chainId: 80001,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2,
    },
    xdai: {
      url: "https://rpc.xdaichain.com",
      accounts,
      chainId: 100,
      live: true,
      saveDeployments: true,
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org",
      accounts,
      chainId: 56,
      live: true,
      saveDeployments: true,
    },
    "bsc-testnet": {
      url: "https://data-seed-prebsc-2-s3.binance.org:8545",
      accounts,
      chainId: 97,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2,
    },
    heco: {
      url: "https://http-mainnet.hecochain.com",
      accounts,
      chainId: 128,
      live: true,
      saveDeployments: true,
    },
    "heco-testnet": {
      url: "https://http-testnet.hecochain.com",
      accounts,
      chainId: 256,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2,
    },
    avalanche: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      accounts,
      chainId: 43114,
      live: true,
      saveDeployments: true,
      gasPrice: 470000000000,
    },
    "avalanche-testnet": {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      accounts,
      chainId: 43113,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2,
    },
    harmony: {
      url: "https://api.s0.t.hmny.io",
      accounts,
      chainId: 1666600000,
      live: true,
      saveDeployments: true,
    },
    "harmony-testnet": {
      url: "https://api.s0.b.hmny.io",
      accounts,
      chainId: 1666700000,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2,
    },
    okex: {
      url: "https://exchainrpc.okex.org",
      accounts,
      chainId: 66,
      live: true,
      saveDeployments: true,
    },
    "okex-testnet": {
      url: "https://exchaintestrpc.okex.org",
      accounts,
      chainId: 65,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2,
    },
  },
  preprocess: {
    eachLine: removeConsoleLog(
      (bre) =>
        bre.network.name !== "hardhat" && bre.network.name !== "localhost"
    ),
  },
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  tenderly: {
    project: process.env.TENDERLY_PROJECT,
    username: process.env.TENDERLY_USERNAME,
  },
  watcher: {
    compile: {
      tasks: ["compile"],
      files: ["./contracts"],
      verbose: true,
    },
  },
};

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
export default config;
