import HRE from 'hardhat'
import { HardhatConfig } from 'hardhat/types'
const { ethers } = HRE

export async function currentBlockTimestamp(): Promise<number> {
  const blockNumber = await ethers.provider.getBlockNumber()
  const block = await ethers.provider.getBlock(blockNumber)
  return block.timestamp
}

export async function advanceBlock(): Promise<void> {
  await ethers.provider.send('evm_mine', [])
}

export async function advanceBlockTo(block: number): Promise<void> {
  while ((await ethers.provider.getBlockNumber()) < block) {
    await ethers.provider.send('evm_mine', [])
  }
}

export async function increase(duration: number): Promise<void> {
  await ethers.provider.send('evm_increaseTime', [duration])
  await advanceBlock()
}

export async function reset(config: HardhatConfig): Promise<void> {
  await ethers.provider.send('hardhat_reset', [
    {
      forking: {
        jsonRpcUrl: config.networks?.hardhat?.forking?.url,
        blockNumber: config.networks?.hardhat?.forking?.blockNumber,
      },
    },
  ])
}
