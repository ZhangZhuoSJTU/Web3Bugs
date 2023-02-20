import { PopulatedTransaction } from "@ethersproject/contracts";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { utils, BigNumber, Contract, ethers } from "ethers";
import { TransactionReceipt } from "@ethersproject/abstract-provider";

export type ABI = "erc20" | "erc721";

export async function sendTx(
  hre: HardhatRuntimeEnvironment,
  tx: PopulatedTransaction
): Promise<TransactionReceipt> {
  console.log("Sending transaction to the pool...");

  const [operator] = await hre.ethers.getSigners();
  const txResp = await operator.sendTransaction(tx);
  console.log(
    `Sent transaction with hash \`${txResp.hash}\`. Waiting confirmation`
  );
  const wait =
    hre.network.name == "hardhat" || hre.network.name == "localhost"
      ? undefined
      : 2;
  const receipt = await txResp.wait(wait);
  console.log("Transaction confirmed");
  return receipt;
}

export const getContract = async (
  hre: HardhatRuntimeEnvironment,
  contractOrNameOrAddress: Contract | string
): Promise<Contract> => {
  if (contractOrNameOrAddress instanceof Contract) {
    return contractOrNameOrAddress;
  }
  try {
    return await hre.getExternalContract(contractOrNameOrAddress);
  } catch {}

  const deployments = await hre.deployments.all();
  for (const name in deployments) {
    const deployment = deployments[name];
    if (
      name === contractOrNameOrAddress ||
      deployment.address === contractOrNameOrAddress
    ) {
      return await hre.ethers.getContractAt(name, deployment.address);
    }
  }
  throw `Contract \`${contractOrNameOrAddress}\` is not found`;
};

export const resolveAddress = async (
  hre: HardhatRuntimeEnvironment,
  contractOrNameOrAddress: Contract | string
): Promise<string> => {
  if (
    typeof contractOrNameOrAddress === "string" &&
    hre.ethers.utils.isAddress(contractOrNameOrAddress)
  ) {
    return contractOrNameOrAddress;
  }
  return (await getContract(hre, contractOrNameOrAddress)).address;
};

export const getContractWithAbi = async (
  hre: HardhatRuntimeEnvironment,
  contractOrNameOrAddress: string | Contract,
  abi: ABI
): Promise<Contract> => {
  const address = await resolveAddress(hre, contractOrNameOrAddress);
  const abiData = require(`./abi/${abi}.abi.json`);
  return await hre.ethers.getContractAt(abiData, address);
};

export const impersonate = async (
  hre: HardhatRuntimeEnvironment,
  accountName: string
) => {
  const address = (await hre.getNamedAccounts())[accountName];
  if (!address)
    throw `Cannot impersonate account ${accountName}. Not found in Named Accounts`;
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  console.log(`Impersonated ${accountName}`);
};

export const uintToBytes32 = (x: BigNumber) =>
  utils.hexZeroPad(utils.hexlify(x), 32).substr(2);
export const int24ToBytes32 = (x: BigNumber) =>
  utils
    .hexZeroPad(
      utils.hexlify(x.toNumber() >= 0 ? x.toNumber() : 2 ** 24 + x.toNumber()),
      32
    )
    .substr(2);
