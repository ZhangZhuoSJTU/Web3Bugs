import { parseEther } from '@ethersproject/units'
import { BigNumber, providers } from 'ethers'
import { ethers, network } from 'hardhat'
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'

export const AddressZero = '0x0000000000000000000000000000000000000000'
export const JunkAddress = '0x0000000000000000000000000000000000000001'
export const FEE_DENOMINATOR = 1000000
export const FEE_LIMIT = 50000
export const MAX_PRICE = parseEther('1')
export const DEFAULT_TIME_DELAY = 5

export function expandToDecimals(n: number, decimals: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(decimals))
}

export function expandTo6Decimals(n: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(6))
}

export function expandTo18Decimals(n: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

export function nowPlusMonths(n: number): number {
    let d = new Date()
    d.setMonth(d.getMonth() + n)
    d.setHours(0, 0, 0, 0)
    return d.getTime() / 1000
}

export function calculateFee(amount: BigNumber, factor: BigNumber): BigNumber {
    return amount.mul(factor).div(FEE_DENOMINATOR).add(1)
}

export function returnFromMockAPY(
    apy: number,
    timeElapsed: number,
    totalSupply: BigNumber
): BigNumber {
    let returnPerSecond = parseEther('1').mul(apy).div(100).div(31536000)
    let expectedShareValue = parseEther('1').add(
        returnPerSecond.mul(timeElapsed)
    )
    return totalSupply.mul(expectedShareValue).div(parseEther('1'))
}

// calculate new amount after subtracting a percentage, represented as a 4 decimal place percent, i.e. 100% = 10000
export function subtractBps(amount: BigNumber, bps: number) {
    return amount.sub(amount.mul(bps).div(10000))
}

export async function setNextTimestamp(
    provider: providers.Web3Provider,
    timestamp: number
): Promise<void> {
    await provider.send('evm_setNextBlockTimestamp', [timestamp])
}

export async function mineBlocks(
    provider: providers.Web3Provider,
    blocks: number
): Promise<void> {
    for (let i = 0; i < blocks; i++) {
        await provider.send('evm_mine', [])
    }
}

export async function mineBlock(
    provider: providers.Web3Provider,
    timestamp: number
): Promise<void> {
    return provider.send('evm_mine', [timestamp])
}

export async function getLastTimestamp(): Promise<number> {
    /**
     * Changed this from ethers.provider.getBlockNumber since if evm_revert is used to return
     * to a snapshot, getBlockNumber will still return the last mined block rather than the
     * block height of the snapshot.
     */
    let currentBlock = await ethers.provider.getBlock('latest')
    return currentBlock.timestamp
}

export async function getLastBlockNumber(): Promise<number> {
    let currentBlock = await ethers.provider.getBlock('latest')
    return currentBlock.number
}

export function hashAddress(address: string): Buffer {
    return Buffer.from(
        ethers.utils.solidityKeccak256(['address'], [address]).slice(2),
        'hex'
    )
}

export function generateMerkleTree(addresses: string[]): MerkleTree {
    const leaves = addresses.map(hashAddress)
    return new MerkleTree(leaves, keccak256, { sortPairs: true })
}

export function revertReason(reason: string) {
    return `VM Exception while processing transaction: reverted with reason string '${reason}'`
}
