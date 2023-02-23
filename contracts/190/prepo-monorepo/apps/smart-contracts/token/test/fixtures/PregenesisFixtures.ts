import { ethers } from 'hardhat'
import { PregenesisPoints, PregenPass, MockPregenPass } from '../../types/generated'

export async function pregenesisPointsFixture(
  pregenPointsName: string,
  pregenPointsSymbol: string
): Promise<PregenesisPoints> {
  const Factory = await ethers.getContractFactory('PregenesisPoints')
  return (await Factory.deploy(pregenPointsName, pregenPointsSymbol)) as unknown as PregenesisPoints
}

export async function pregenPassFixture(pregenPassURI: string): Promise<PregenPass> {
  const Factory = await ethers.getContractFactory('PregenPass')
  return (await Factory.deploy(pregenPassURI)) as unknown as PregenPass
}

export async function mockPregenPassFixture(mockPregenPassURI: string): Promise<MockPregenPass> {
  const Factory = await ethers.getContractFactory('MockPregenPass')
  return (await Factory.deploy(mockPregenPassURI)) as unknown as MockPregenPass
}
