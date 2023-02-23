import { ethers } from 'hardhat'
import { FixedUintValue } from '../../types/generated'

export async function fixedUintValueFixture(): Promise<FixedUintValue> {
  const factory = await ethers.getContractFactory('FixedUintValue')
  return (await factory.deploy()) as FixedUintValue
}
