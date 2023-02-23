import { ethers } from 'hardhat'
import { Vesting, MockVestingClaimer } from '../../types/generated'

export async function vestingFixture(): Promise<Vesting> {
  const Factory = await ethers.getContractFactory('Vesting')
  return (await Factory.deploy()) as unknown as Vesting
}

export async function mockVestingClaimerFixture(
  vestingAddress: string
): Promise<MockVestingClaimer> {
  const Factory = await ethers.getContractFactory('MockVestingClaimer')
  return (await Factory.deploy(vestingAddress)) as unknown as MockVestingClaimer
}
