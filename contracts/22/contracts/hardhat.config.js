require("hardhat-spdx-license-identifier");
require("@tenderly/hardhat-tenderly"); // https://hardhat.org/plugins/tenderly-hardhat-tenderly.html
require("@float-capital/solidity-coverage");

require("./hardhat-plugins/codegen");

require("hardhat-docgen");

let runCoverage =
  !process.env.DONT_RUN_REPORT_SUMMARY ||
  process.env.DONT_RUN_REPORT_SUMMARY.toUpperCase() != "TRUE";
if (runCoverage) {
  require("hardhat-abi-exporter");
  require("hardhat-gas-reporter");
}
let isWaffleTest =
  !!process.env.WAFFLE_TEST && process.env.WAFFLE_TEST.toUpperCase() == "TRUE";
if (isWaffleTest) {
  require("./test-waffle/Setup.js").mochaSetup();
  require("@nomiclabs/hardhat-waffle");
} else {
  require("@nomiclabs/hardhat-truffle5");
}

// This is a sample Buidler task. To learn how to create your own go to
// https://buidler.dev/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more
module.exports = {
  // This is a sample solc configuration that specifies which version of solc to use
  solidity: {
    version: "0.8.3",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    mumbai: {
      chainId: 80001,
      url: "https://rpc-mumbai.maticvigil.com/v1",
    },
  },
  paths: {
    tests: isWaffleTest ? "./test-waffle" : "./test",
  },
  gasReporter: {
    // Disabled by default for faster running of tests
    enabled: true,
    currency: "USD",
    gasPrice: 80,
    coinmarketcap: "9aacee3e-7c04-4978-8f93-63198c0fbfef",
  },
  spdxLicenseIdentifier: {
    // Set these to true if you ever want to change the licence on all of the contracts (by changing it in package.json)
    overwrite: false,
    runOnCompile: false,
  },
  abiExporter: {
    path: "./abis",
    clear: true,
    flat: true,
    only: [
      ":ERC20Mock$",
      ":YieldManagerMock$",
      ":LongShort$",
      ":SyntheticToken$",
      ":YieldManagerAave$",
      ":FloatCapital_v0$",
      ":Migrations$",
      ":TokenFactory$",
      ":FloatToken$",
      ":Staker$",
      ":Treasury_v0$",
      ":OracleManager$",
      ":OracleManagerChainlink$",
      ":OracleManagerMock$",
      ":LendingPoolAaveMock$",
      ":AaveIncentivesControllerMock$",
      "Mockable$",
    ],
    spacing: 2,
  },
  docgen: {
    path: "./contract-docs",
    only: [
      "^contracts/LongShort",
      "^contracts/Staker",
      "^contracts/FloatToken",
      "^contracts/SyntheticToken",
      "^contracts/TokenFactory",
      "^contracts/YieldManagerAave",
    ],
  },
};
