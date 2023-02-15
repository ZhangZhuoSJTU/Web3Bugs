import { ethers } from 'hardhat'

export async function advanceTime(time: number) {
  await ethers.provider.send('evm_increaseTime', [time])
}

export async function setTime(time: number) {
  await ethers.provider.send('evm_setNextBlockTimestamp', [time])
}

async function advanceBlock() {
  const block = await getBlock('latest')
  return block.hash
}

export async function advanceTimeAndBlock(time: number) {
  await advanceTime(time)
  await advanceBlock()
}

export async function now(): Promise<bigint> {
  const block = await getBlock('latest')
  return BigInt(block.timestamp)
}

export async function getBlock(blockHashOrBlockTag: string) {
  const block = await ethers.provider.getBlock(blockHashOrBlockTag)
  return block
}

export async function getTimestamp(blockHash: string): Promise<bigint> {
  const block = await getBlock(blockHash)
  return BigInt(block.timestamp)
}
export function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  let z = a * b
  z = z / denominator
  return z
}

export function mulDivUp(a: bigint, b: bigint, denominator: bigint): bigint {
  let z = mulDiv(a, b, denominator)
  let mulmod = (a * b) % denominator
  if (mulmod > 0) z++
  return z
}

export function sqrt(y: bigint): bigint {
  let z = 0n

  if (y > 3n) {
    z = y
    let x = y / 2n + 1n
    while (x < z) {
      z = x
      x = (y / x + x) / 2n
    }
  } else if (y != 0n) {
    z = 1n
  }

  return z
}

export function sqrtUp(y: bigint): bigint {
  let z = sqrt(y)
  if (z % y > 0n) z++
  return z
}

export function min(x: bigint, y: bigint, z: bigint): bigint {
  if (x <= y && x <= z) {
    return x
  } else if (y <= x && y <= z) {
    return y
  } else {
    return z
  }
}

export function divUp(x: bigint, y: bigint): bigint {
  let z = x / y
  if (x % y > 0) z++
  return z
}

export function shiftRightUp(x: bigint, y: bigint): bigint {
  let z = x >> y
  if (x != z << y) z++
  return z
}

export default {
  now,
  advanceTimeAndBlock,
  getBlock,
  getTimestamp,
  setTime,
  mulDiv,
  min,
  mulDivUp,
  divUp,
  shiftRightUp,
}
