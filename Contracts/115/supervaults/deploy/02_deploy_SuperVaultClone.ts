import * as dotenv from "dotenv";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { SuperVaultFactory } from "../typechain";
import * as utils from "../utils/TestUtils";

dotenv.config();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts } = hre;

  const { owner } = await getNamedAccounts();

  const SuperVaultFactory: SuperVaultFactory = await ethers.getContract("SuperVaultFactory");
  const superVaultInterface = await ethers.getContractFactory("SuperVault");

  // This needs to be deployed once per user
  const superVaultData = superVaultInterface.interface.encodeFunctionData("initialize", [
    utils.ADDRESS_PROVIDER,
    utils.GOVERNANCE_ADDRESS_PROVIDER,
    utils.AAVE_LENDING_POOL,
    owner,
    utils.DEX_ADDRESS_PROVIDER,
  ]);

  const cloneTx = await SuperVaultFactory.clone(superVaultData);
  const cloneReceipt = await cloneTx.wait(1);

  // @ts-ignore this address should be searchable in the subgraph
  const userSuperVault = cloneReceipt.events[1].args.superVaultContract;

  console.log(`supervault cloned at ${userSuperVault}`); // Hardhat deploy won't log the clone address since it isn't considered a new contract instance
};

export default func;
func.tags = ["SuperVaultClone"];
func.dependencies = ["SuperVault"];
