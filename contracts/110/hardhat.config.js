require("@nomiclabs/hardhat-waffle");
const { subtask } = require("hardhat/config");
const {
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
  TASK_COMPILE_SOLIDITY_READ_FILE,
} = require("hardhat/builtin-tasks/task-names");

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), "g"), replace);
}

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
  async (_, __, runSuper) => {
    const paths = await runSuper();
    return paths.filter((p) => !p.includes("/test/"));
  }
);

subtask(TASK_COMPILE_SOLIDITY_READ_FILE).setAction(async (_, __, runSuper) => {
  const file = await runSuper();
  const replacedOpenZepplin = replaceAll(
    file,
    '"openzeppelin-contracts',
    '"@openzeppelin/contracts'
  );
  const replacedDSTest = replaceAll(
    replacedOpenZepplin,
    "ds-test/test.sol",
    "../lib/ds-test/src/test.sol"
  );
  return replacedDSTest;
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./hh-cache",
    artifacts: "./artifacts",
  },
};
