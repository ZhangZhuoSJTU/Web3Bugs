import chai from 'chai'
import { BigNumber } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { SafeCastTest } from '../../typechain/SafeCastTest'
import { expect } from '../shared/Expect'

const { solidity } = waffle
chai.use(solidity)

let safeCastTestContract: SafeCastTest
const MaxUint32 = BigNumber.from(2).pow(32).sub(1)
const MaxUint112 = BigNumber.from(2).pow(112).sub(1)
const MaxUint113 = BigNumber.from(2).pow(113).sub(1)
const MaxUint128 = BigNumber.from(2).pow(128).sub(1)
const MaxUint256 = BigNumber.from(2).pow(256).sub(1)

describe('safeCast', () => {
  beforeEach(async () => {
    const safeCastTestContactFactory = await ethers.getContractFactory('SafeCastTest')
    safeCastTestContract = (await safeCastTestContactFactory.deploy()) as SafeCastTest
    await safeCastTestContract.deployed()
  })

  it('should return uint112', async () => {
    let returnValue1 = await safeCastTestContract.toUint112(MaxUint32)
    expect(returnValue1).to.be.equal(MaxUint32)
  })
  it('should return uint128', async () => {
    let returnValue1 = await safeCastTestContract.toUint128(MaxUint128)
    expect(returnValue1).to.be.equal(MaxUint128)
  })
  it('should modUint32', async () => {
    let returnValue1 = await safeCastTestContract.modUint32(MaxUint256)
    let returnValue2 = returnValue1 % BigNumber.from(0x100000000).toNumber()
    expect(returnValue1).to.be.equal(returnValue2)
  })

  it('should truncate to Uint112', async () => {
    expect(await safeCastTestContract.truncateUint112(MaxUint113)).to.be.equal(MaxUint112)
  })
})
