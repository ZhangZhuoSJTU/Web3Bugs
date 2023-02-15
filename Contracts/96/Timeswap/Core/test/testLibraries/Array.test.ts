import chai, { expect } from 'chai'
import { ethers, waffle } from 'hardhat'
import { ArrayTest } from '../../typechain/ArrayTest'

const { solidity } = waffle
chai.use(solidity)

interface Due {
  debt: bigint
  collateral: bigint
  startBlock: bigint
}

let ArrayTestContract: ArrayTest

const dues = [
  {
    debt: 10n,
    collateral: 5n,
    startBlock: 1631585271n,
  },
  {
    debt: 100n,
    collateral: 50n,
    startBlock: 1631585272n,
  },
]

const dueOut = {
  debt: 1n,
  collateral: 1n,
  startBlock: 1631585273n,
}

describe('Borrow Math', () => {
  before(async () => {
    const ArrayTestContractFactory = await ethers.getContractFactory('ArrayTest')
    ArrayTestContract = (await ArrayTestContractFactory.deploy()) as ArrayTest
    await ArrayTestContract.deployed()
  })

  it('Insert should return insert the new item and retrun the correct id', async () => {
    const id = await ArrayTestContract.callStatic.insert(dues, dueOut)
    const duesLength = dues.length
    expect(id.toString()).to.be.equal(String(duesLength))
  })
})
