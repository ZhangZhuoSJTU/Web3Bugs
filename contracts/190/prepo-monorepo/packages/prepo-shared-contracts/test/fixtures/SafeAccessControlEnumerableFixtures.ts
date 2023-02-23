import { ethers, upgrades } from 'hardhat'
import {
  SafeAccessControlEnumerable,
  SafeAccessControlEnumerableUpgradeableTest,
} from '../../types/generated'

export async function safeAccessControlEnumerableFixture(): Promise<SafeAccessControlEnumerable> {
  const Factory = await ethers.getContractFactory('SafeAccessControlEnumerable')
  return (await Factory.deploy()) as SafeAccessControlEnumerable
}

export async function safeAccessControlEnumerableUpgradeableTestFixture(): Promise<SafeAccessControlEnumerableUpgradeableTest> {
  const Factory = await ethers.getContractFactory('SafeAccessControlEnumerableUpgradeableTest')
  return (await upgrades.deployProxy(Factory)) as SafeAccessControlEnumerableUpgradeableTest
}
