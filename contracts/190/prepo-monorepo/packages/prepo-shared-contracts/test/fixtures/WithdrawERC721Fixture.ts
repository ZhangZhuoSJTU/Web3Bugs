import { ethers } from 'hardhat'
import { WithdrawERC721 } from '../../types/generated'

export async function withdrawERC721Fixture(): Promise<WithdrawERC721> {
  const Factory = await ethers.getContractFactory('WithdrawERC721')
  return (await Factory.deploy()) as WithdrawERC721
}
