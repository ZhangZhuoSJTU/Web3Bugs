import type { ethers } from "ethers";
import { NetworkConfig } from "hardhat/types";


// Adds a `gas` field to the ABI function elements so that ethers doesn't
// automatically estimate gas limits on every call. Halves execution time.
// (Borrowed from hardhat-ethers/src/internal/helpers.ts)
export function addGasToAbiMethods(
  networkConfig: NetworkConfig,
  abi: any[]
): any[] {
  const { BigNumber } = require("ethers") as typeof ethers;

  // Stay well under network limit b/c ethers adds a margin
  // Also need special setting logic for coverage b/c it compiles
  // before configuring the network with higher gas values.
  let gas: number;
  if (process.env.COVERAGE === "true") {
    const CoverageAPI: any = require("solidity-coverage/api");
    gas = new CoverageAPI().gasLimit as number;
  } else {
    gas = networkConfig.gas as number;
  }

  const gasLimit = BigNumber.from(gas).sub(1000000).toHexString();

  const modifiedAbi: any[] = [];

  for (const abiElement of abi) {
    if (abiElement.type !== "function") {
      modifiedAbi.push(abiElement);
      continue;
    }

    modifiedAbi.push({
      ...abiElement,
      gas: gasLimit,
    });
  }

  return modifiedAbi;
}

// Removes gas field from ABI. Useful when temporarily modifying external artifacts
// that have variable gas requirements depending on use context (e.g coverage, different networks)
export function removeGasFromAbiMethods(abi: any[]) {
  const modifiedAbi: any[] = [];

  for (const abiElement of abi) {
    if (abiElement.type !== "function") {
      modifiedAbi.push(abiElement);
      continue;
    }

    delete abiElement.gas;

    modifiedAbi.push(abiElement);
  }

  return modifiedAbi;
}
