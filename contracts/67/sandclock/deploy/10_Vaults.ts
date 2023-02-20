import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { DeployFunction } from "hardhat-deploy/types";

import { ethers } from "hardhat";

import { deployViaFactory, logContract } from "../scripts/deployHelpers";

const func: DeployFunction = async function (env: HardhatRuntimeEnvironment) {
  const { get } = env.deployments;

  const usdc = await get("USDC");
  const dai = await get("DAI");

  const minLockPeriod = env.network.live ? 60 * 60 * 24 * 30 : 0;

  await deployVault(env, "Vault_USDC", usdc.address, minLockPeriod);
  await deployVault(env, "Vault_DAI", dai.address, minLockPeriod);
};

async function deployVault(
  env: HardhatRuntimeEnvironment,
  name: string,
  underlyingAddr: string,
  minLockPeriod: number
) {
  const { read, getOrNull } = env.deployments;

  if (await getOrNull(name)) {
    console.log(`Skipping deploy of ${name}`);
    return;
  }

  const Vault = await ethers.getContractFactory("Vault");

  const { address } = await deployViaFactory(env, "deployVault", name, Vault, [
    underlyingAddr,
    minLockPeriod,
  ]);

  const claimers = await read(name, "claimers");
  const depositors = await read(name, "depositors");

  logContract(name, address);
  logContract(`${name}_Claimers`, claimers);
  logContract(`${name}_Depositors`, depositors);
}

func.id = "deploy_vaults";
func.tags = ["Vaults"];

export default func;
