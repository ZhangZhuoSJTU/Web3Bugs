import { FakeContract, smock } from '@defi-wonderland/smock'
import { ethers } from 'hardhat'
import { AccountList } from '../../types/generated'

export async function accountListFixture(): Promise<AccountList> {
  const Factory = await ethers.getContractFactory('AccountList')
  return (await Factory.deploy()) as AccountList
}

export async function fakeAccountListFixture(): Promise<FakeContract> {
  const fakeContract = await smock.fake('AccountList')
  return fakeContract
}
