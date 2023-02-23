import { ethers } from 'hardhat'
import { MockContract, FakeContract, smock } from '@defi-wonderland/smock'
import {
  DepositHook,
  WithdrawHook,
  ManagerWithdrawHook,
  MintHook,
  RedeemHook,
} from '../../typechain'

export async function depositHookFixture(): Promise<DepositHook> {
  const depositHook = await ethers.getContractFactory('DepositHook')
  return (await depositHook.deploy()) as unknown as DepositHook
}

export async function withdrawHookFixture(): Promise<WithdrawHook> {
  const withdrawHook = await ethers.getContractFactory('WithdrawHook')
  return (await withdrawHook.deploy()) as unknown as WithdrawHook
}

export async function managerWithdrawHookFixture(): Promise<ManagerWithdrawHook> {
  const managerWithdrawHook = await ethers.getContractFactory('ManagerWithdrawHook')
  return (await managerWithdrawHook.deploy()) as ManagerWithdrawHook
}

export async function mintHookFixture(): Promise<MintHook> {
  const factory = await ethers.getContractFactory('MintHook')
  return (await factory.deploy()) as MintHook
}

export async function redeemHookFixture(): Promise<RedeemHook> {
  const factory = await ethers.getContractFactory('RedeemHook')
  return (await factory.deploy()) as RedeemHook
}

export async function smockDepositHookFixture(): Promise<MockContract> {
  const smockDepositHookFactory = await smock.mock('DepositHook')
  return smockDepositHookFactory.deploy()
}

export async function smockWithdrawHookFixture(): Promise<MockContract> {
  const smockWithdrawHookFactory = await smock.mock('WithdrawHook')
  return smockWithdrawHookFactory.deploy()
}

export async function smockManagerWithdrawHookFixture(): Promise<MockContract> {
  const smockManagerWithdrawHookFactory = await smock.mock('ManagerWithdrawHook')
  return smockManagerWithdrawHookFactory.deploy()
}

export async function smockMintHookFixture(): Promise<MockContract> {
  const smockFactory = await smock.mock('MintHook')
  return smockFactory.deploy()
}

export async function smockRedeemHookFixture(): Promise<MockContract> {
  const smockFactory = await smock.mock('RedeemHook')
  return smockFactory.deploy()
}

export async function smockAccountListFixture(): Promise<MockContract> {
  const smockAccountListFactory = await smock.mock('AccountList')
  return smockAccountListFactory.deploy()
}

export async function fakeAccountListFixture(): Promise<FakeContract> {
  const fakeContract = await smock.fake('AccountList')
  return fakeContract
}

export async function fakeMintHookFixture(): Promise<FakeContract> {
  const fakeContract = await smock.fake('MintHook')
  return fakeContract
}

export async function fakeRedeemHookFixture(): Promise<FakeContract> {
  const fakeContract = await smock.fake('RedeemHook')
  return fakeContract
}
