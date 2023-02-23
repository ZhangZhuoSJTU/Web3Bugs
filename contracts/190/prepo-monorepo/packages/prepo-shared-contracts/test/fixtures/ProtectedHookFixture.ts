import { ethers } from 'hardhat'
import { ProtectedHookTest } from '../../types/generated'

export async function protectedHookTestFixture(): Promise<ProtectedHookTest> {
  const Factory = await ethers.getContractFactory('ProtectedHookTest')
  return (await Factory.deploy()) as ProtectedHookTest
}
