import { ethers, upgrades } from 'hardhat'
import { MockContract, FakeContract, smock } from '@defi-wonderland/smock'
import { Collateral } from '../../typechain'

export async function collateralFixture(
  name: string,
  symbol: string,
  baseToken: string,
  baseTokenDecimals: number
): Promise<Collateral> {
  const Factory = await ethers.getContractFactory('Collateral')
  return (await upgrades.deployProxy(Factory, [name, symbol], {
    unsafeAllow: ['constructor', 'state-variable-immutable'],
    constructorArgs: [baseToken, baseTokenDecimals],
  })) as Collateral
}

export async function smockCollateralFixture(
  name: string,
  symbol: string,
  baseToken: string,
  baseTokenDecimals: number
): Promise<MockContract> {
  const mockFactory = await smock.mock('Collateral')
  const smockCollateral = await mockFactory.deploy(baseToken, baseTokenDecimals)
  await smockCollateral.initialize(name, symbol)
  return smockCollateral
}

export async function fakeCollateralFixture(): Promise<FakeContract> {
  const fakeContract = await smock.fake('Collateral')
  return fakeContract
}
