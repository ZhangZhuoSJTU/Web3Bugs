import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { ContractFactory } from "ethers";

import { ethers } from "hardhat";

const deployOutput = [];

const { keccak256, id, hexConcat, FormatTypes, getCreate2Address } =
  ethers.utils;

export function logContract(name: string, address: string) {
  deployOutput.push({ name, address });
}

export function printLog() {
  console.table(deployOutput);
}

export async function deployViaFactory(
  env: HardhatRuntimeEnvironment,
  func: string,
  name: string,
  contract: ContractFactory,
  args: any[]
) {
  const { deployer } = await env.getNamedAccounts();
  const { execute, get, getOrNull, save } = env.deployments;

  const factory = await get("SandclockFactory");
  const existing = await getOrNull(name);

  // CREATE2 params
  const salt = id(name);
  const encodedArgs = contract.interface.encodeDeploy(args);
  const code = hexConcat([contract.bytecode, encodedArgs]);

  // derive CREATE2 address used for the vault
  const address = getCreate2Address(factory.address, salt, keccak256(code));

  if (existing && existing.address == address) {
    console.log(`Skipping deploy of ${name}`);
    return { address, skipped: true };
  }

  // deploy vault via factory
  await execute("SandclockFactory", { from: deployer }, func, code, salt);

  // manually save deployment info
  await save(name, {
    address,
    abi: contract.interface.format(FormatTypes.json) as any[],
  });

  return { address, skipped: false };
}
