import { ethers } from 'hardhat'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { TokenSenderCaller } from '../../types/generated'

export async function tokenSenderCallerFixture(): Promise<TokenSenderCaller> {
  const factory = await ethers.getContractFactory('TokenSenderCaller')
  return (await factory.deploy()) as TokenSenderCaller
}

export async function fakeTokenSenderCallerFixture(): Promise<FakeContract> {
  const fakeContract = await smock.fake('TokenSenderCaller')
  return fakeContract
}
