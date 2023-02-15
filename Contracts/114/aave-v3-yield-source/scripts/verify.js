#!/usr/bin/env node
const chalk = require("chalk");
const util = require("util");
const find = require("find");
const fs = require("fs");
const exec = util.promisify(require("child_process").exec);
const hardhat = require("hardhat");

const info = (msg) => console.log(chalk.dim(msg));
const success = (msg) => console.log(chalk.green(msg));
const error = (msg) => console.error(chalk.red(msg));

const getContract = async (name) => {
  const { deployments } = hardhat;
  const signers = await hardhat.ethers.getSigners();
  return hardhat.ethers.getContractAt(name, (await deployments.get(name)).address, signers[0]);
};

const verifyAddress = async (address, name, path = "", args = "") => {
  /*
    needs to be in form:
    hardhat verify --config <hardhat.config.<NETWORK>.js>
      --network <network-name> <address>
      --contract <PATH-TO-CONTRACT:CONTRACT-NAME>
      <Constructor Args seperated by spaces>

      as per https://www.npmjs.com/package/@nomiclabs/hardhat-etherscan
  */

  const network = hardhat.network.name;
  const config = getHardhatConfigFile(network);
  let contractFlag = "";

  if (path != "") {
    contractFlag = "--contract " + path;
  }

  try {
    const cmd = `hardhat ${config} verify --network ${network} ${address} ${contractFlag} ${args}`;
    info(`running: ${cmd}`);
    await exec(cmd.trim());
  } catch (e) {
    if (/Contract source code already verified/.test(e.message)) {
      info(`${name} already verified`);
    } else {
      error(e.message);
      console.error(e);
    }
  }
};

const verifyProxyFactoryInstance = async (name) => {
  const proxyFactory = await getContract(name);
  const instanceAddress = await proxyFactory.instance();
  info(`Verifying ${name} Instance at ${instanceAddress}...`);
  await verifyAddress(instanceAddress, name);
  success(`Verified ${name} Instance!`);
};

function isBinance() {
  const network = hardhat.network.name;
  return /bsc/.test(network);
}

function isPolygon() {
  const network = hardhat.network.name;
  return /polygon/.test(network) || /matic/.test(network);
}

function getHardhatConfigFile(network) {
  let config;
  if (isBinance()) {
    config = "--config hardhat.config.bsc.js";
  } else if (isPolygon()) {
    config = "--config hardhat.config.polygon.js";
  } else {
    config = "";
  }
  return config;
}

async function verifyEtherscanClone() {
  const network = hardhat.network.name;

  info(`verifying contracts on Etherscan Clone`);

  const filePath = "./deployments/" + network + "/";

  let toplevelContracts = [];

  // read deployment JSON files
  fs.readdirSync(filePath).filter((fileName) => {
    if (fileName.includes(".json")) {
      const contractName = fileName.substring(0, fileName.length - 5).trim(); // strip .json
      const contractDirPath = find.fileSync(contractName + ".sol", "./contracts")[0];
      if (!contractDirPath) {
        error(`There is no matching contract for ${contractName}. This is likely becuase the deployment contract name is different from the Solidity contract title.
         Run verification manually. See verifyEtherscanClone() for details`);
        return;
      }
      const deployment = JSON.parse(fs.readFileSync(filePath + fileName, "utf8"));

      toplevelContracts.push({
        address: deployment.address,
        contractPath: contractDirPath + ":" + contractName,
        contractName,
        constructorArgs: deployment.args,
      });
    }
  });

  info(`Attempting to verify ${toplevelContracts.length} top level contracts`);

  toplevelContracts.forEach(async (contract) => {
    let args = "";

    if (contract.constructorArgs.length > 0) {
      contract.constructorArgs.forEach((arg) => {
        args = args.concat('"', arg, '" '); // format constructor args in correct form - "arg" "arg"
      });
    }

    await verifyAddress(contract.address, contract.contractName, contract.contractPath, args);
  });
}

async function run() {
  const network = hardhat.network.name;

  info(`Verifying top-level contracts on network: ${network}`);

  if (network == "matic" || network == "bsc") {
    await verifyEtherscanClone();
  } else {
    info(`verifying contracts using native Hardhat verify`);
    // using hardhat native etherscan verify -- this supports mainnet, rinkeby, kovan etc.
    const { stdout, stderr } = await exec(
      `hardhat --network ${network} etherscan-verify --solc-input --api-key ${process.env.ETHERSCAN_API_KEY}`
    );
    console.log(chalk.yellow(stdout));
    console.log(chalk.red(stderr));
  }

  info(`Done top-level contracts`);

  info(`Verifying proxy factory instances...`);

  // await verifyProxyFactoryInstance('CompoundPrizePoolProxyFactory')

  success("Done!");
}

run();
