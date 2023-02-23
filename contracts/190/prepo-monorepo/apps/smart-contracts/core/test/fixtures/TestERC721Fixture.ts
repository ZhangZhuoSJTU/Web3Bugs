import { ethers } from 'hardhat'
import { TestERC721 } from '../../typechain/TestERC721'

export async function testERC721Fixture(
  tokenName: string,
  tokenSymbol: string
): Promise<TestERC721> {
  const testERC721 = await ethers.getContractFactory('TestERC721')
  return (await testERC721.deploy(tokenName, tokenSymbol)) as TestERC721
}
