import chai from 'chai'
import { ethers, waffle } from 'hardhat'
import { BlockNumberTest } from '../../typechain/BlockNumberTest'
import { expect } from '../shared/Expect'
const { solidity } = waffle
chai.use(solidity)

let blockNumberTestContract: BlockNumberTest

describe('BlockNumber', () => {
  before(async () => {
    const BlockNumberTestContractFactory = await ethers.getContractFactory('BlockNumberTest')
    blockNumberTestContract = (await BlockNumberTestContractFactory.deploy()) as BlockNumberTest
    await blockNumberTestContract.deployed()
  })
  it('Should return blockNumber', async () => {
    expect(await blockNumberTestContract.get()).to.be.equalBigInt
  })
})
