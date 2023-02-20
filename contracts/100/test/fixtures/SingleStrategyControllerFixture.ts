import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { SingleStrategyController } from '../../typechain/SingleStrategyController'

chai.use(solidity)

export async function singleStrategyControllerFixture(
    token: string
): Promise<SingleStrategyController> {
    const SingleStrategyController = await ethers.getContractFactory(
        'SingleStrategyController'
    )
    return (await SingleStrategyController.deploy(token)) as any
}
