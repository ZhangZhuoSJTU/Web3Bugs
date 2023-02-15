// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
require("dotenv").config();

const { formatContract, writeToJson } = require("./utils/generate");

async function main() {
  const CoreCollection = await hre.ethers.getContractFactory("CoreCollection");
  const coreCollection = await CoreCollection.deploy();

  await coreCollection.deployed();

  console.log("CoreCollection deployed to:", coreCollection.address);

  console.log(`npx hardhat verify ${coreCollection.address}`);

  const CoreMembership = await hre.ethers.getContractFactory("CoreMembership");
  const coreMembership = await CoreMembership.deploy();

  await coreMembership.deployed();

  console.log("CoreMembership deployed to:", coreMembership.address);

  console.log(`npx hardhat verify ${coreMembership.address}`);

  // using dummy address. need to be updated
  const chestrWallet = process.env.CHESTR_WALLET || "0x1A8EFaC3E19dd34c8353F9e4a14B585BCE361dd2";
  const spliterContract = process.env.SPLITTER_CONTRACT || "0x1A8EFaC3E19dd34c8353F9e4a14B585BCE361dd2";

  const CoreFactory = await hre.ethers.getContractFactory("CoreFactory");
  const coreFactory = await CoreFactory.deploy(
    coreMembership.address,
    coreCollection.address,
    chestrWallet,
    spliterContract
  );

  await coreFactory.deployed();

  console.log("CoreFactory deployed to:", coreFactory.address);

  console.log(
    `npx hardhat verify ${coreFactory.address} ${coreMembership.address} ${coreCollection.address} ${chestrWallet} ${spliterContract}`
  );

  // copying abis and contract address => networks
  const contracts = ["CoreCollection", "CoreMembership", "CoreFactory"];
  const addresses = [
    coreCollection.address,
    coreMembership.address,
    coreFactory.address,
  ];

  const content = contracts.reduce((value, contract, index) => {
    return {
      ...value,
      ...formatContract(contract, addresses[index]),
    };
  }, {});

  const chainId = (await hre.waffle.provider.getNetwork()).chainId;
  writeToJson(chainId, content);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
