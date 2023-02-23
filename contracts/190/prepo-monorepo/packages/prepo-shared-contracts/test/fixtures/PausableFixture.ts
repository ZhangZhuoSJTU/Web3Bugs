import { ethers } from 'hardhat'
import { PausableTest } from '../../types/generated'

export async function pausableTestFixture(): Promise<PausableTest> {
  const Factory = await ethers.getContractFactory('PausableTest')
  return (await Factory.deploy()) as PausableTest
}
