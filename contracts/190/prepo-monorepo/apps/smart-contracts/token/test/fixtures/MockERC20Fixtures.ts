import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { MockERC20 } from '../../types/generated'

export async function mockERC20Fixture(
  mockERC20Name: string,
  mockERC20Symbol: string,
  decimal: number,
  initialRecipient: string,
  initialMint: BigNumber
): Promise<MockERC20> {
  const Factory = await ethers.getContractFactory('MockERC20')
  return (await Factory.deploy(
    mockERC20Name,
    mockERC20Symbol,
    decimal,
    initialRecipient,
    initialMint
  )) as unknown as MockERC20
}
