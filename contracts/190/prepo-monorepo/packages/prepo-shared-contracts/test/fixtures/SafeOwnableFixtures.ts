import { ethers, upgrades } from 'hardhat'
import { SafeOwnable, SafeOwnableUpgradeableTest } from '../../types/generated'

export async function safeOwnableFixture(): Promise<SafeOwnable> {
  const Factory = await ethers.getContractFactory('SafeOwnable')
  return (await Factory.deploy()) as SafeOwnable
}

export async function safeOwnableUpgradeableTestFixture(): Promise<SafeOwnableUpgradeableTest> {
  const Factory = await ethers.getContractFactory('SafeOwnableUpgradeableTest')
  return (await upgrades.deployProxy(Factory)) as SafeOwnableUpgradeableTest
}
