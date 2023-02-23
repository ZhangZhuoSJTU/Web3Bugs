import { ethers } from 'hardhat'
import { WithdrawERC20 } from '../../types/generated'

export async function withdrawERC20Fixture(): Promise<WithdrawERC20> {
  const Factory = await ethers.getContractFactory('WithdrawERC20')
  return (await Factory.deploy()) as WithdrawERC20
}
