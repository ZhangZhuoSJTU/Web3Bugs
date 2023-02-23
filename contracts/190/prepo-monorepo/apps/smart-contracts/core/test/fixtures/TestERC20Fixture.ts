import { ethers } from 'hardhat'
import { MockContract, smock } from '@defi-wonderland/smock'
import { TestERC20 } from '../../typechain/TestERC20'

export async function testERC20Fixture(
  tokenName: string,
  tokenSymbol: string,
  decimals: number
): Promise<TestERC20> {
  const testERC20 = await ethers.getContractFactory('TestERC20')
  return (await testERC20.deploy(tokenName, tokenSymbol, decimals)) as TestERC20
}

export async function smockTestERC20Fixture(
  tokenName: string,
  tokenSymbol: string,
  decimals: number
): Promise<MockContract> {
  const smockFactory = await smock.mock('TestERC20')
  return (await smockFactory.deploy(tokenName, tokenSymbol, decimals)) as MockContract
}
