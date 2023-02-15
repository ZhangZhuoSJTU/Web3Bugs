import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { MockStrategy } from '../../typechain/MockStrategy'

chai.use(solidity)

export async function mockStrategyFixture(
    controller: string,
    baseToken: string
): Promise<MockStrategy> {
    const MockStrategy = await ethers.getContractFactory('MockStrategy')
    return (await MockStrategy.deploy(controller, baseToken)) as any
}
