import { ethers } from 'hardhat'
import { MockContract, FakeContract, smock } from '@defi-wonderland/smock'
import { TokenSender } from '../../typechain'

export async function tokenSenderFixture(outputToken): Promise<TokenSender> {
  const factory = await ethers.getContractFactory('TokenSender')
  return (await factory.deploy(outputToken)) as unknown as TokenSender
}

export async function smockTokenSenderFixture(outputToken): Promise<MockContract> {
  const mockFactory = await smock.mock('TokenSender')
  return mockFactory.deploy(outputToken)
}

export async function fakeTokenSenderFixture(outputToken): Promise<FakeContract> {
  const fakeTokenSender = await smock.fake('TokenSender')
  return fakeTokenSender
}
