import {
  TASK_VERIFY,
  TASK_VERIFY_VERIFY,
} from "@nomiclabs/hardhat-etherscan/dist/src/constants";
import axios from "axios";
import { deployContract } from "ethereum-waffle";
import { ContractJSON } from "ethereum-waffle/dist/esm/ContractJSON";
import { BigNumber, Signer } from "ethers";
import { HardhatRuntimeEnvironment, RunTaskFunction } from "hardhat/types";
import { EIP712Domain, PermitJoin, PermitExit } from "../constants";

export const buildDataExit = ({
  name,
  chainId,
  verifyingContract,
  sender,
  token,
  amount,
  targetAmount,
  nonce,
  deadline,
}: any) => ({
  primaryType: "PermitExit" as "EIP712Domain" | "PermitExit",
  types: { EIP712Domain, PermitExit },
  domain: { name, version: "1", chainId, verifyingContract },
  message: {
    sender,
    sourceToken: token,
    amount,
    targetAmount,
    nonce,
    deadline,
  },
});

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const buildDataJoin = ({
  name,
  chainId,
  verifyingContract,
  sender,
  token,
  amount,
  targetAmount,
  nonce,
  deadline,
}: any) => ({
  primaryType: "PermitJoin" as "EIP712Domain" | "PermitJoin",
  types: { EIP712Domain, PermitJoin },
  domain: { name, version: "1", chainId, verifyingContract },
  message: {
    sender,
    targetToken: token,
    amount,
    targetAmount,
    nonce,
    deadline,
  },
});

export const getTrades = async (
  basketAmount: string,
  interactionToken: string,
  type: string
): Promise<
  [
    string,
    {
      quantity: string;
      swaps: any[];
    }[],
    string
  ]
> => {
  const apiResponse = (
    await axios.get(
      `https://lima-api.amun.com/swaps/matic/${type}/0x1660F10B4D610cF482194356eCe8eFD65B15bA83?interactionToken=${interactionToken}&desiredAmount=${basketAmount}`
    )
  ).data as { path: any[]; outputAmount: string; inputAmount: string }[];
  let trades = apiResponse.map(({ path: swaps, outputAmount: quantity }) => ({
    quantity,
    swaps,
  }));

  let inputAmount = apiResponse
    .reduce((sum, { inputAmount }) => sum.add(inputAmount), BigNumber.from(0))
    .mul(2)
    .toString() as string;
  let outputAmount = apiResponse
    .reduce((sum, { outputAmount }) => sum.add(outputAmount), BigNumber.from(0))
    .toString() as string;
  return [inputAmount, trades, outputAmount];
};
