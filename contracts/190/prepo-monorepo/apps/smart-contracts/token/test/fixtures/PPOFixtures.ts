import { ethers, upgrades } from 'hardhat'
import { MockContract, smock } from '@defi-wonderland/smock'
import {
  PPO,
  AccountList,
  RestrictedTransferHook,
  BlocklistTransferHook,
} from '../../types/generated'

export async function ppoFixture(name: string, symbol: string): Promise<PPO> {
  const Factory = await ethers.getContractFactory('PPO')
  return (await upgrades.deployProxy(Factory, [name, symbol])) as PPO
}

export async function accountListFixture(): Promise<AccountList> {
  const Factory = await ethers.getContractFactory('AccountList')
  return (await Factory.deploy()) as AccountList
}

export async function restrictedTransferHookFixture(): Promise<RestrictedTransferHook> {
  const Factory = await ethers.getContractFactory('RestrictedTransferHook')
  return (await Factory.deploy()) as RestrictedTransferHook
}

export async function blocklistTransferHookFixture(): Promise<BlocklistTransferHook> {
  const Factory = await ethers.getContractFactory('BlocklistTransferHook')
  return (await Factory.deploy()) as BlocklistTransferHook
}

export async function smockAccountListFixture(): Promise<MockContract> {
  const smockAccountListFactory = await smock.mock('AccountList')
  return (await smockAccountListFactory.deploy()) as MockContract
}
