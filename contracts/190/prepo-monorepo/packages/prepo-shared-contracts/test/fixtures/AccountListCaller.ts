import { ethers } from 'hardhat'
import { MockContract, smock } from '@defi-wonderland/smock'
import { AccountListCaller } from '../../types/generated'

export async function accountListCallerFixture(): Promise<AccountListCaller> {
  const factory = await ethers.getContractFactory('AccountListCaller')
  return (await factory.deploy()) as AccountListCaller
}
