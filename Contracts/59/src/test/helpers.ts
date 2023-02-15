import { ethers } from "hardhat";

export async function mineBlocks(amount: number) {
  for (let i = 0; i < amount; i++) {
    await ethers.provider.send('evm_mine', []);
  }
}

export async function increaseTime(amount: number) {
  await ethers.provider.send('evm_increaseTime', [amount]);
  await mineBlocks(1);
}

export async function setNextBlockTime(timestamp: number) {
  await ethers.provider.send('evm_setNextBlockTimestamp', [timestamp]);
}

export async function hardhatSnapshot() {
  return await ethers.provider.send('evm_snapshot', []);
}

export async function hardhatRevert(snapshotId: string) {
  return await ethers.provider.send('evm_revert', [snapshotId]);
}
