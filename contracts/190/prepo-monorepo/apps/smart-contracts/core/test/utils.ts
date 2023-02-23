import { parseEther } from '@ethersproject/units'
import { BigNumber, Contract } from 'ethers'
import { ethers, network } from 'hardhat'
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { FakeContract, MockContract } from '@defi-wonderland/smock'
import { utils } from 'prepo-hardhat'
import { PermitStruct } from '../typechain/DepositTradeHelper'

const { getPermitSignature } = utils

export const FEE_DENOMINATOR = 1000000
export const COLLATERAL_FEE_LIMIT = 100000
export const MARKET_FEE_LIMIT = 100000
export const MAX_PAYOUT = parseEther('1')
export const DEFAULT_TIME_DELAY = 5
export const PERCENT_DENOMINATOR = 1000000

export function calculateFee(amount: BigNumber, factor: BigNumber): BigNumber {
  return amount.mul(factor).div(FEE_DENOMINATOR)
}

export function returnFromMockAPY(
  apy: number,
  timeElapsed: number,
  totalSupply: BigNumber
): BigNumber {
  const returnPerSecond = parseEther('1').mul(apy).div(100).div(31536000)
  const expectedShareValue = parseEther('1').add(returnPerSecond.mul(timeElapsed))
  return totalSupply.mul(expectedShareValue).div(parseEther('1'))
}

// calculate new amount after subtracting a percentage, represented as a 4 decimal place percent, i.e. 100% = 10000
export function subtractBps(amount: BigNumber, bps: number): BigNumber {
  return amount.sub(amount.mul(bps).div(10000))
}

export async function getLastTimestamp(): Promise<number> {
  /**
   * Changed this from ethers.provider.getBlockNumber since if evm_revert is used to return
   * to a snapshot, getBlockNumber will still return the last mined block rather than the
   * block height of the snapshot.
   */
  const currentBlock = await ethers.provider.getBlock('latest')
  return currentBlock.timestamp
}

export async function getLastBlockNumber(): Promise<number> {
  const currentBlock = await ethers.provider.getBlock('latest')
  return currentBlock.number
}

export function hashAddress(address: string): Buffer {
  return Buffer.from(ethers.utils.solidityKeccak256(['address'], [address]).slice(2), 'hex')
}

export function generateMerkleTree(addresses: string[]): MerkleTree {
  const leaves = addresses.map(hashAddress)
  return new MerkleTree(leaves, keccak256, { sortPairs: true })
}

export async function grantAndAcceptRole(
  contract: Contract | MockContract,
  admin: SignerWithAddress,
  nominee: SignerWithAddress,
  role: string
): Promise<void> {
  await contract.connect(admin).grantRole(role, nominee.address)
  await contract.connect(nominee).acceptRole(role)
}

export async function batchGrantAndAcceptRoles(
  contract: Contract | MockContract,
  admin: SignerWithAddress,
  nominee: SignerWithAddress,
  roleGetters: Promise<string>[]
): Promise<void> {
  const promises: Promise<void>[] = []
  const roles = await Promise.all(roleGetters)
  roles.forEach((role) => {
    promises.push(grantAndAcceptRole(contract, admin, nominee, role))
  })
  await Promise.all(promises)
}

export async function getSignerForContract(
  contract: Contract | MockContract | FakeContract
): Promise<SignerWithAddress> {
  /**
   * This gets the signer for a contract. The signer is needed to call
   * contract.connect(signer).functionName() to call a function on behalf of the contract.
   * This additionally funds the contract address with 1 eth for gas.
   */
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [contract.address],
  })
  const signer = await ethers.getSigner(contract.address)
  await network.provider.send('hardhat_setBalance', [
    contract.address,
    '0xde0b6b3a7640000', // 1 eth in hex
  ])
  return signer
}

export async function getPermitFromSignature(
  token: Contract | MockContract,
  signer: SignerWithAddress,
  spender: string,
  value: BigNumber,
  deadline: number
): Promise<PermitStruct> {
  const signature = await getPermitSignature(token, signer, spender, value, deadline)
  return <PermitStruct>{
    deadline,
    v: signature.v,
    r: signature.r,
    s: signature.s,
  }
}
