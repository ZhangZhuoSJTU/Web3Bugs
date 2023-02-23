import { ethers } from 'hardhat'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { TokenShop } from '../../types/generated'
import { PurchaseHook } from '../../types/generated/contracts/token-shop/PurchaseHook'

export async function tokenShopFixture(paymentToken: string): Promise<TokenShop> {
  const Factory = await ethers.getContractFactory('TokenShop')
  return (await Factory.deploy(paymentToken)) as unknown as TokenShop
}

export async function purchaseHookFixture(): Promise<PurchaseHook> {
  const Factory = await ethers.getContractFactory(
    'contracts/token-shop/PurchaseHook.sol:PurchaseHook'
  )
  return (await Factory.deploy()) as unknown as PurchaseHook
}

export async function fakePurchaseHookFixture(): Promise<FakeContract> {
  return (await smock.fake('contracts/token-shop/PurchaseHook.sol:PurchaseHook')) as FakeContract
}
