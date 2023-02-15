import { BigNumber, Bytes, ContractFactory, providers, Signer } from "ethers"

import { Artifact } from "hardhat/types"
import { Contract } from "@ethersproject/contracts"
import { ERC20 } from "../build/typechain/ERC20"
import { Swap } from "../build/typechain/Swap"
import { ethers, network } from "hardhat"
import { BytesLike } from "@ethersproject/bytes"

import merkleTreeDataTest from "../test/exampleMerkleTree.json"

export const MAX_UINT256 = ethers.constants.MaxUint256
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

export enum TIME {
  SECONDS = 1,
  DAYS = 86400,
  WEEKS = 604800,
}

// DEPLOYMENT helper functions

// Workaround for linking libraries not yet working in buidler-waffle plugin
// https://github.com/nomiclabs/buidler/issues/611
export function linkBytecode(
  artifact: Artifact,
  libraries: Record<string, string>,
): string | Bytes {
  let bytecode = artifact.bytecode

  for (const [, fileReferences] of Object.entries(artifact.linkReferences)) {
    for (const [libName, fixups] of Object.entries(fileReferences)) {
      const addr = libraries[libName]
      if (addr === undefined) {
        continue
      }

      for (const fixup of fixups) {
        bytecode =
          bytecode.substr(0, 2 + fixup.start * 2) +
          addr.substr(2) +
          bytecode.substr(2 + (fixup.start + fixup.length) * 2)
      }
    }
  }

  return bytecode
}

export async function deployContractWithLibraries(
  signer: Signer,
  artifact: Artifact,
  libraries: Record<string, string>,
  args?: Array<unknown>,
): Promise<Contract> {
  const swapFactory = (await ethers.getContractFactory(
    artifact.abi,
    linkBytecode(artifact, libraries),
    signer,
  )) as ContractFactory

  if (args) {
    return swapFactory.deploy(...args)
  } else {
    return swapFactory.deploy()
  }
}

export function getTestMerkleRoot(): string {
  return merkleTreeDataTest.merkleRoot
}

export function getTestMerkleAllowedAccounts(): Record<string, any> {
  return merkleTreeDataTest.allowedAccounts
}

export function getTestMerkleProof(address: string): BytesLike[] {
  const ALLOWED_ACCOUNTS: Record<string, any> = getTestMerkleAllowedAccounts()

  if (address in ALLOWED_ACCOUNTS) {
    return ALLOWED_ACCOUNTS[address].proof
  }
  return []
}

// Contract calls

export async function getPoolBalances(
  swap: Swap,
  numOfTokens: number,
): Promise<BigNumber[]> {
  const balances = []

  for (let i = 0; i < numOfTokens; i++) {
    balances.push(await swap.getTokenBalance(i))
  }
  return balances
}

export async function getUserTokenBalances(
  address: string | Signer,
  tokens: ERC20[],
): Promise<BigNumber[]> {
  const balanceArray = []

  if (address instanceof Signer) {
    address = await address.getAddress()
  }

  for (const token of tokens) {
    balanceArray.push(await token.balanceOf(address))
  }

  return balanceArray
}

export async function getUserTokenBalance(
  address: string | Signer,
  token: ERC20,
): Promise<BigNumber> {
  if (address instanceof Signer) {
    address = await address.getAddress()
  }
  return token.balanceOf(address)
}

// EVM methods

export async function setNextTimestamp(timestamp: number): Promise<any> {
  const chainId = (await ethers.provider.getNetwork()).chainId

  switch (chainId) {
    case 31337: // buidler evm
      return ethers.provider.send("evm_setNextBlockTimestamp", [timestamp])
    case 1337: // ganache
    default:
      return ethers.provider.send("evm_mine", [timestamp])
  }
}

export async function setTimestamp(timestamp: number): Promise<any> {
  return ethers.provider.send("evm_mine", [timestamp])
}

export async function increaseTimestamp(timestampDelta: number): Promise<any> {
  await ethers.provider.send("evm_increaseTime", [timestampDelta])
  return ethers.provider.send("evm_mine", [])
}

export async function takeSnapshot(): Promise<number> {
  return await ethers.provider.send("evm_snapshot", [])
}

export async function revertToSnapshot(id: number): Promise<any> {
  return await ethers.provider.send("evm_revert", [id])
}

export async function getCurrentBlockTimestamp(): Promise<number> {
  return (
    await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
  ).timestamp
}

export async function impersonateAccount(
  address: string,
): Promise<providers.JsonRpcSigner> {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  })

  return ethers.provider.getSigner(address)
}

export async function asyncForEach<T>(
  array: Array<T>,
  callback: (item: T, index: number) => void,
): Promise<void> {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index)
  }
}
