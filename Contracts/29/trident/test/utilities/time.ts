import { BigNumber } from "@ethersproject/bignumber";
import { BigNumberish } from "ethers";
import { ethers } from "hardhat";

export async function advanceBlock() {
  return ethers.provider.send("evm_mine", []);
}

export async function advanceBlockTo(blockNumber: number): Promise<void> {
  for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
    await advanceBlock();
  }
}

export async function increase(value: BigNumber): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [value.toNumber()]);
  await advanceBlock();
}

export async function latest(): Promise<BigNumber> {
  const block = await ethers.provider.getBlock("latest");
  return BigNumber.from(block.timestamp);
}

export async function advanceTimeAndBlock(time: BigNumber): Promise<void> {
  await advanceTime(time);
  await advanceBlock();
}

export async function advanceTime(time: BigNumber): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [time]);
}

export const duration = {
  seconds: function (value: BigNumberish): BigNumber {
    return BigNumber.from(value);
  },
  minutes: function (value: BigNumberish): BigNumber {
    return BigNumber.from(value).mul(this.seconds("60"));
  },
  hours: function (value: BigNumberish): BigNumber {
    return BigNumber.from(value).mul(this.minutes("60"));
  },
  days: function (value: BigNumberish): BigNumber {
    return BigNumber.from(value).mul(this.hours("24"));
  },
  weeks: function (value: BigNumberish): BigNumber {
    return BigNumber.from(value).mul(this.days("7"));
  },
  years: function (value: BigNumberish): BigNumber {
    return BigNumber.from(value).mul(this.days("365"));
  },
};
