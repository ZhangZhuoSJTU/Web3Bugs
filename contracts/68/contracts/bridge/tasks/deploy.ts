import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";

import { task } from "hardhat/config";
import { TASK_VERIFY_VERIFY } from "@nomiclabs/hardhat-etherscan/dist/src/constants";

import { MintableERC20 } from "../types";
import {
  mumbaiChildChainManagerProxy,
  maticChildChainManagerProxy,
  mainnetPredicateProxy,
  testPredicateProxy,
} from "../constants";
import { HardhatRuntimeEnvironment, Network } from "hardhat/types";
import { Signer } from "ethers";

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export const deployProxyAndVerify = async (
  signer: Signer,
  name: string,
  hre: HardhatRuntimeEnvironment,
  constructorArgsParams: any[],
  verify: boolean = true,
  options = {}
) => {
  console.log("Before deploy Contract");

  const contractFactory = await hre.ethers.getContractFactory(name, signer);
  const contract = await hre.upgrades.deployProxy(
    contractFactory,
    constructorArgsParams,
    options
  );
  await contract.deployed();
  await timeout(8000);

  const proxyAdmin = await hre.upgrades.admin.getInstance();
  console.log(`Contract deployed at: "${contract.address}"`);

  let implementationContractAddress = await proxyAdmin.getProxyImplementation(
    contract.address
  );

  // verify implementation contract
  if (implementationContractAddress && verify) {
    console.log(
      `Contract implementation deployed at: "${implementationContractAddress}"`
    );
    await hre.run(TASK_VERIFY_VERIFY, {
      address: implementationContractAddress,
      constructorArgsParams,
    });
  }

  return contract;
};

const isVerifiable = (network: Network) =>
  network.name != "fork" && network.name != "hardhat";

task(
  "deploy-root-wpeco",
  "Deploy root chain version of a Matic bridgeable token"
).setAction(async (taskArgs, hre) => {
  const { run, ethers, network } = hre;

  const isMainnet = network.name == "mainnet";
  const signers = await ethers.getSigners();
  const PredicateProxy = isMainnet ? mainnetPredicateProxy : testPredicateProxy;
  const constructorArgsParams = ["wPECO", "wPECO", PredicateProxy];

  const mintableERC20 = (await deployProxyAndVerify(
    signers[0],
    "MintableERC20",
    hre,
    constructorArgsParams,
    isVerifiable(network)
  )) as MintableERC20;

  console.log("Root chain WPECO token address:", mintableERC20.address);
  return mintableERC20;
});

// Deploys token bridged by matic bridge on root chain
task(
  "deploy-child-wpeco",
  "Deploy child chain version of a Matic bridgeable token"
)
  .addParam(
    "basket",
    "Address of basket that should be wrapped and made bridgeable"
  )
  .setAction(async ({ basket }, hre) => {
    const { ethers, network, run } = hre;

    hre.config.etherscan.apiKey = process.env.POLYSCAN_KEY;

    const isMumbai = hre.network.name == "mumbai";
    const signers = await ethers.getSigners();

    const constructorArgsParams = [
      basket,
      isMumbai ? mumbaiChildChainManagerProxy : maticChildChainManagerProxy,
      "wrapped PECO",
      "wPECO",
    ];

    const mintableERC20 = (await deployProxyAndVerify(
      signers[0],
      "PolygonERC20Wrapper",
      hre,
      constructorArgsParams,
      isVerifiable(network)
    )) as MintableERC20;

    console.log("Child chain WPECO  token address:", mintableERC20.address);
    return mintableERC20;
  });
