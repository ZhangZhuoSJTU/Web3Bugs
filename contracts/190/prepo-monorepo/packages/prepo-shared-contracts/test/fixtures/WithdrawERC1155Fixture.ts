import { ethers } from 'hardhat'
import { WithdrawERC1155 } from '../../types/generated'

export async function withdrawERC1155Fixture(): Promise<WithdrawERC1155> {
  const Factory = await ethers.getContractFactory('WithdrawERC1155')
  return (await Factory.deploy()) as WithdrawERC1155
}
