import { ethers } from 'hardhat'
import { SafeOwnableCallerTest } from '../../types/generated'

export async function safeOwnableCallerTestFixture(): Promise<SafeOwnableCallerTest> {
  const Factory = await ethers.getContractFactory('SafeOwnableCallerTest')
  return (await Factory.deploy()) as SafeOwnableCallerTest
}
