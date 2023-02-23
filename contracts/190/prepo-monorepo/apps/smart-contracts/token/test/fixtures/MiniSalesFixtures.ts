import { ethers } from 'hardhat'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { MiniSales, AllowlistPurchaseHook, MiniSalesFlag } from '../../types/generated'

export async function miniSalesFixture(
  saleTokenAddress: string,
  paymentTokenAddress: string,
  saleTokenDecimals: number
): Promise<MiniSales> {
  const Factory = await ethers.getContractFactory('MiniSales')
  return (await Factory.deploy(
    saleTokenAddress,
    paymentTokenAddress,
    saleTokenDecimals
  )) as MiniSales
}

export async function allowlistPurchaseHookFixture(): Promise<AllowlistPurchaseHook> {
  const Factory = await ethers.getContractFactory('AllowlistPurchaseHook')
  return (await Factory.deploy()) as AllowlistPurchaseHook
}

export async function fakeAllowlistPurchaseHookFixture(): Promise<FakeContract> {
  return (await smock.fake('AllowlistPurchaseHook')) as FakeContract
}

export async function fakeAccountListFixture(): Promise<FakeContract> {
  return (await smock.fake('AccountList')) as FakeContract
}

export async function miniSalesFlagFixture(): Promise<MiniSalesFlag> {
  const Factory = await ethers.getContractFactory('MiniSalesFlag')
  return (await Factory.deploy()) as MiniSalesFlag
}
