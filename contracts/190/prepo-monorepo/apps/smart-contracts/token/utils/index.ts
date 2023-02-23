/* eslint-disable no-await-in-loop */
import { BigNumber, BigNumberish, Signature } from 'ethers'
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'
import { solidityKeccak256, formatBytes32String, splitSignature } from 'ethers/lib/utils'
import { TypedDataUtils, SignTypedDataVersion } from '@metamask/eth-sig-util'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ERC20PermitUpgradeable } from '../types/generated'

export const MAX_UINT64 = BigNumber.from(2).pow(64).sub(1)
export const MAX_INT64 = BigNumber.from(2).pow(63).sub(1)
export const MIN_INT64 = BigNumber.from(2).pow(63).mul(-1)
export const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1)
export const MAX_UINT256 = BigNumber.from(2).pow(256).sub(1)
export const ZERO = BigNumber.from(0)
export const ONE = BigNumber.from(1)
export const ZERO_HASH = formatBytes32String('')
export const ONE_WEEK = BigNumber.from(60 * 60 * 24 * 7)

export type IOUPPOLeafNode = {
  account: string
  amount: BigNumber
  staked: boolean
}

export type AccountAmountLeafNode = {
  account: string
  amount: BigNumber
}

export function hashIOUPPOLeafNode(leaf: IOUPPOLeafNode): Buffer {
  /**
   * slice(2) removes '0x' from the hash
   */
  return Buffer.from(
    solidityKeccak256(
      ['address', 'uint256', 'bool'],
      [leaf.account, leaf.amount, leaf.staked]
    ).slice(2),
    'hex'
  )
}

export function generateMerkleTreeIOUPPO(leaves: IOUPPOLeafNode[]): MerkleTree {
  const leafNodes = leaves.map(hashIOUPPOLeafNode)
  return new MerkleTree(leafNodes, keccak256, { sortPairs: true })
}

export function hashAccountAmountLeafNode(leaf: AccountAmountLeafNode): Buffer {
  // slice(2) removes '0x' from the hash
  return Buffer.from(
    solidityKeccak256(['address', 'uint256'], [leaf.account, leaf.amount]).slice(2),
    'hex'
  )
}

export function generateAccountAmountMerkleTree(leaves: AccountAmountLeafNode[]): MerkleTree {
  const leafNodes = leaves.map(hashAccountAmountLeafNode)
  return new MerkleTree(leafNodes, keccak256, { sortPairs: true })
}

/**
 * Calculate the new weighted timestamp after depositing or withdrawing PPO
 * @param oldWeightedTimestamp
 * @param currentTimestamp
 * @param oldStakedBalance
 * @param stakedDelta The absolute difference between new and old balances. Always positive
 * @param staking True if depositing, false if withdrawing PPO from a staked position
 * @returns New weighted timestamp
 */
export function calcWeightedTimestamp(
  oldWeightedTimestamp: BigNumberish,
  currentTimestamp: BigNumberish,
  oldStakedBalance: BigNumber,
  stakedDelta: BigNumber,
  staking: boolean
): number {
  const oldWeightedTimestampBN = BigNumber.from(oldWeightedTimestamp)
  const currentTimestampBN = BigNumber.from(currentTimestamp)
  const oldWeightedSeconds = currentTimestampBN.sub(oldWeightedTimestampBN)
  const adjustedStakedBalanceDelta = staking ? stakedDelta.div(2) : stakedDelta.div(8)
  const adjustedNewStakedBalance = staking
    ? oldStakedBalance.add(adjustedStakedBalanceDelta)
    : oldStakedBalance.sub(adjustedStakedBalanceDelta)
  const newWeightedSeconds = staking
    ? oldStakedBalance.mul(oldWeightedSeconds).div(adjustedNewStakedBalance)
    : adjustedNewStakedBalance.mul(oldWeightedSeconds).div(oldStakedBalance)

  return currentTimestampBN.sub(newWeightedSeconds).toNumber()
}

/**
 * Calculate when to subsequently deposit/withdraw PPO to obtain a certain weighted timestamp
 * @param oldWeightedTimestamp
 * @param weightedTimeDelta The desired increase in time from the previous weighted timestamp
 * @param oldStakedBalance
 * @param stakedDelta The absolute difference between new and old balances. Always positive
 * @param staking True if depositing, false if withdrawing PPO from a staked position
 * @returns Time at which to stake to achieve the desired weighted timestamp
 */
export function calcTimeToStakeAt(
  oldWeightedTimestamp: BigNumberish,
  weightedTimeDelta: BigNumberish,
  oldStakedBalance: BigNumber,
  stakedDelta: BigNumber,
  staking: boolean
): number {
  const oldWeightedTimestampBN = BigNumber.from(oldWeightedTimestamp)
  const weightedTimeDeltaBN = BigNumber.from(weightedTimeDelta)
  const adjustedStakedBalanceDelta = staking ? stakedDelta.div(2) : stakedDelta.div(8)
  const adjustedNewStakedBalance = staking
    ? oldStakedBalance.add(adjustedStakedBalanceDelta)
    : oldStakedBalance.sub(adjustedStakedBalanceDelta)
  const newWeightedDelta = staking
    ? adjustedNewStakedBalance.mul(weightedTimeDeltaBN).div(oldStakedBalance)
    : oldStakedBalance.mul(weightedTimeDeltaBN).div(adjustedNewStakedBalance)
  return newWeightedDelta.add(oldWeightedTimestampBN).toNumber()
}

export function divRoundingUp(num: BigNumber, denominator: BigNumber): BigNumber {
  const res = num.div(denominator)
  const remainder = num.mod(denominator)
  if (remainder.eq(0)) return res
  return res.add(1)
}

// from OpenZeppelin's test suite
export const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
]

// from OpenZeppelin's test suite
export const Permit = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
]

// from OpenZeppelin's test suite
export function generateDomainSeparator(
  name: string,
  version: string,
  chainId: number,
  verifyingContract: string
): string {
  return `0x${TypedDataUtils.hashStruct(
    'EIP712Domain',
    { name, version, chainId, verifyingContract },
    { EIP712Domain },
    SignTypedDataVersion.V4
  ).toString('hex')}`
}

// from Uniswap V3 Periphery's test suite
export async function getPermitSignature(
  token: ERC20PermitUpgradeable,
  signer: SignerWithAddress,
  spender: string,
  value: BigNumber,
  deadline: number
): Promise<Signature> {
  const [nonce, name, version, chainId] = await Promise.all([
    token.nonces(signer.address),
    token.name(),
    '1',
    signer.getChainId(),
  ])
  return splitSignature(
    await signer._signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: token.address,
      },
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: signer.address,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  )
}
