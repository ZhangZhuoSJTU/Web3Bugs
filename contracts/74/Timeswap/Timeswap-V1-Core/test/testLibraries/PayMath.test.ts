import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import { ethers, waffle } from 'hardhat'
import { PayMathTest } from '../../typechain/PayMathTest'
import PayMath from '../libraries/PayMath'
import { expect } from '../shared/Expect'

let signers: SignerWithAddress[]

const { solidity } = waffle
chai.use(solidity)

interface Due {
  debt: bigint
  collateral: bigint
  startBlock: bigint
}

const due: Due = {
  debt: 1000n,
  collateral: 1000n,
  startBlock: 1631585272n,
}

let PayMathTestContract: PayMathTest
const assetIn: bigint = 500n
const collateralOut: bigint = 400n

describe('Pay Math', () => {
  before(async () => {
    signers = await ethers.getSigners()
    const PayMathTestContractFactory = await ethers.getContractFactory('PayMathTest')
    PayMathTestContract = (await PayMathTestContractFactory.deploy()) as PayMathTest
    await PayMathTestContract.deployed()
  })

  it('Pay Proptional should return true with less than 50% collateral out', async () => {
    const returnValue1 = await PayMathTestContract.checkProportional(assetIn, collateralOut, due)
    const returnValue2 = await PayMath.checkProportional(assetIn, collateralOut, due)
    expect(returnValue1).to.be.true
    expect(returnValue2).to.be.true
    expect(returnValue1).to.equal(returnValue2)
  })

  it('Pay Proptional should return true with exact 50% collateral out', async () => {
    const collateralOut: bigint = 500n
    const returnValue1 = await PayMathTestContract.checkProportional(assetIn, collateralOut, due)
    const returnValue2 = await PayMath.checkProportional(assetIn, collateralOut, due)
    expect(returnValue1).to.be.true
    expect(returnValue2).to.be.true
    expect(returnValue1).to.equal(returnValue2)
  })

  it('Pay Proptional should return revert with E303', async () => {
    const collateralOut: bigint = 600n
    await expect(PayMathTestContract.checkProportional(assetIn, collateralOut, due)).to.be.revertedWith('E303')
    expect(await PayMath.checkProportional(assetIn, collateralOut, due)).to.be.false
  })
})
