import { ethers } from 'hardhat'
import { NFTScoreRequirement } from '../../types/generated'

export async function nftScoreRequirementFixture(): Promise<NFTScoreRequirement> {
  const factory = await ethers.getContractFactory('NFTScoreRequirement')
  return (await factory.deploy()) as NFTScoreRequirement
}
