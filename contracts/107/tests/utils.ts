import { ethers } from "hardhat";
import chai from "chai";
import { BigNumberish } from "@ethersproject/bignumber";

const { expect } = chai;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const units = (value: number) =>
  ethers.utils.parseUnits(value.toString());
export const bn = (value: BigNumberish) => ethers.BigNumber.from(value);
export const days = (value: number) => value * 24 * 60 * 60;

export const timeTravel = async (seconds: number) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
};

export const mineBlock = async () => {
  await ethers.provider.send("evm_mine", []);
};

export const mineBlocks = async (n: number) => {
  for (let i = 0; i < n; i++) {
    await mineBlock();
  }
};

export const checkAlmostSame = (a: BigNumberish, b: BigNumberish) => {
  expect(
    ethers.BigNumber.from(a).gte(ethers.BigNumber.from(b).mul(98).div(100))
  ).to.be.true;
  expect(
    ethers.BigNumber.from(a).lte(ethers.BigNumber.from(b).mul(102).div(100))
  ).to.be.true;
};

export const currentTimestamp = async () => {
  return (await ethers.provider.getBlock("latest")).timestamp;
};
