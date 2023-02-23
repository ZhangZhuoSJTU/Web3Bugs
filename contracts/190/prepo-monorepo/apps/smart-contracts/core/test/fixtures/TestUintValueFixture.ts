import { ethers } from 'hardhat'
import { MockContract, smock } from '@defi-wonderland/smock'
import { TestUintValue } from '../../typechain/TestUintValue'

export async function testUintValueFixture(): Promise<TestUintValue> {
  const factory = await ethers.getContractFactory('TestUintValue')
  return (await factory.deploy()) as TestUintValue
}

export async function smockTestUintValueFixture(): Promise<MockContract> {
  const smockFactory = await smock.mock('TestUintValue')
  return (await smockFactory.deploy()) as MockContract
}
