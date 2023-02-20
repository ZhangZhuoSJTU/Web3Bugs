import { ethers } from "hardhat";

const { BigNumber } = ethers

export async function advanceBlock() {
  return ethers.provider.send("evm_mine", [])
}

export async function advanceBlockTo(blockNumber) {
  for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
    await advanceBlock()
  }
}

export async function blockNumber() {
  const block = await ethers.provider.getBlock("latest")
  return BigNumber.from(block.number)
}

export async function latest() {
  const block = await ethers.provider.getBlock("latest")
  return BigNumber.from(block.timestamp)
}

export async function advanceTimeAndBlock(time) {
  await advanceTime(time)
  await advanceBlock()
}

export async function advanceTime(time) {
  await ethers.provider.send("evm_increaseTime", [time])
  await advanceBlock()
}

// Does not mine any blocks, and wall clock time has no effect.
export async function advanceNextTime(offset) {
  const { timestamp } = await ethers.provider.getBlock("latest")
  const next = timestamp + offset
  await ethers.provider.send("evm_setNextBlockTimestamp", [next])
  return next
}

export const duration = {
  seconds: function (val) {
    return BigNumber.from(val)
  },
  minutes: function (val) {
    return BigNumber.from(val).mul(this.seconds("60"))
  },
  hours: function (val) {
    return BigNumber.from(val).mul(this.minutes("60"))
  },
  days: function (val) {
    return BigNumber.from(val).mul(this.hours("24"))
  },
  weeks: function (val) {
    return BigNumber.from(val).mul(this.days("7"))
  },
  years: function (val) {
    return BigNumber.from(val).mul(this.days("365"))
  },
}
