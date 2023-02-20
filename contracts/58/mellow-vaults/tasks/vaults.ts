import { BigNumber, Contract } from "ethers";
import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { map, pipe, prop, sortBy, zip } from "ramda";
import { getContract, getContractWithAbi, sendTx } from "./base";
import { CREATE_CELL_EVENT_HASH } from "./contants";

task("deposit", "Deposits tokens into cell")
  .addParam("name", "Name of the cells contracts", undefined, types.string)
  .addParam("nft", "Nft of the cell", undefined, types.string)
  .addParam("tokens", "Token names or addresses for deposit", [], types.json)
  .addParam("tokenAmounts", "Token amounts to deposit", [], types.json)
  .setAction(async ({ name, nft, tokens, tokenAmounts }, hre) => {
    await deposit(hre, name, nft, tokens, tokenAmounts.map(BigNumber.from));
  });

task("withdraw", "Withdraw tokens from cell")
  .addParam("name", "Name of the cells contracts", undefined, types.string)
  .addParam("nft", "Nft of the cell", undefined, types.string)
  .addParam("to", "Address to withdraw to", undefined, types.string)
  .addParam("tokens", "Token names or addresses for deposit", [], types.json)
  .addParam("tokenAmounts", "Token amounts to deposit", [], types.json)
  .setAction(async ({ name, nft, to, tokens, tokenAmounts }, hre) => {
    await withdraw(
      hre,
      name,
      nft,
      to,
      tokens,
      tokenAmounts.map(BigNumber.from)
    );
  });

task("create-cell", "Mints nft for Vaults contract")
  .addParam(
    "cells",
    "The name or address of the cells contract",
    undefined,
    types.string
  )
  .addParam("tokens", "The name of the token0", undefined, types.json)
  .addOptionalParam("params", "Optional params", undefined, types.string)
  .setAction(async ({ cells, tokens, params }, hre) => {
    await createVault(hre, cells, tokens, params);
  });

export const deposit = async (
  hre: HardhatRuntimeEnvironment,
  cellsNameOrAddressOrContract: Contract | string,
  nft: BigNumber,
  tokenNameOrAddressOrContracts: (Contract | string)[],
  tokenAmounts: BigNumber[]
) => {
  console.log(
    `Depositing to \`${cellsNameOrAddressOrContract}\`, nft \`${nft.toString()}\`...`
  );

  const { addresses, amounts } = await extractSortedTokenAddressesAndAmounts(
    hre,
    tokenNameOrAddressOrContracts,
    tokenAmounts
  );
  const contract = await getContract(hre, cellsNameOrAddressOrContract);

  await sendTx(
    hre,
    await contract.populateTransaction.deposit(nft, addresses, amounts)
  );
};

export const withdraw = async (
  hre: HardhatRuntimeEnvironment,
  cellsNameOrAddressOrContract: Contract | string,
  nft: BigNumber,
  to: string,
  tokenNameOrAddressOrContracts: (Contract | string)[],
  tokenAmounts: BigNumber[]
) => {
  console.log(
    `Withdrawing from \`${cellsNameOrAddressOrContract}\`, nft \`${nft.toString()}\` to \`${to}\`...`
  );
  const { addresses, amounts } = await extractSortedTokenAddressesAndAmounts(
    hre,
    tokenNameOrAddressOrContracts,
    tokenAmounts
  );
  const contract = await getContract(hre, cellsNameOrAddressOrContract);
  await sendTx(
    hre,
    await contract.populateTransaction.withdraw(nft, to, addresses, amounts)
  );
};

export const createVault = async (
  hre: HardhatRuntimeEnvironment,
  cellsNameOrAddressOrContract: Contract | string,
  tokenNameOrAddressOrContracts: (Contract | string)[],
  params?: string
): Promise<BigNumber> => {
  console.log(`Creating cell for ${cellsNameOrAddressOrContract}`);

  const { addresses } = await extractSortedTokenAddressesAndAmounts(
    hre,
    tokenNameOrAddressOrContracts,
    Array(tokenNameOrAddressOrContracts.length)
  );

  const cells = await getContract(hre, cellsNameOrAddressOrContract);
  const receipt = await sendTx(
    hre,
    await cells.populateTransaction.createVault(addresses, params || [])
  );
  for (const log of receipt.logs) {
    if (log.topics[0] === CREATE_CELL_EVENT_HASH) {
      const nft = BigNumber.from(log.topics[2]);
      console.log(`Minted cell nft: ${nft.toString()}`);
      return nft;
    }
  }
  console.log(receipt.logs);
  throw `Could not find nft number in tx logs`;
};

const extractSortedTokenAddressesAndAmounts = async (
  hre: HardhatRuntimeEnvironment,
  tokenNameOrAddressOrContracts: (Contract | string)[],
  tokenAmounts: BigNumber[]
): Promise<{ addresses: string[]; amounts: BigNumber[] }> => {
  const tokenContracts = await Promise.all(
    map(
      (name) => getContractWithAbi(hre, name, "erc20"),
      tokenNameOrAddressOrContracts
    )
  );
  const tokenData = pipe(
    map(prop("address")),
    zip(tokenAmounts),
    map(([amount, address]) => ({ address, amount })),
    sortBy(prop("address"))
  )(tokenContracts);
  const sortedAddresses = map(prop("address"), tokenData);
  const sortedAmounts = map(prop("amount"), tokenData);
  // @ts-ignore
  return { addresses: sortedAddresses, amounts: sortedAmounts };
};
