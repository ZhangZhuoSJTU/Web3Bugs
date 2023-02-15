import { BigNumberish } from '@ethersproject/bignumber'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import { ethers, waffle } from 'hardhat'
import { LendMathTest } from '../../typechain/LendMathTest'
import LendMath from '../libraries/LendMath'
import { expect } from '../shared/Expect'
import { now } from '../shared/Helper'

let signers: SignerWithAddress[]

const { solidity } = waffle
chai.use(solidity)

interface Token {
  asset: bigint
  collateral: bigint
}
interface Claims {
  bondPrincipal: bigint
  bondInterest: bigint
  insurancePrincipal: bigint
  insuranceInterest: bigint
}
interface StateParams {
  reserves: Token
  totalLiquidity: bigint
  totalClaims: Claims
  totalDebtCreated: bigint
  x: bigint
  y: bigint
  z: bigint
}

interface StateTestParams {
  asset: bigint
  interest: bigint
  cdp: bigint
}

const state: StateParams = {
  reserves: { asset: 0n, collateral: 0n },
  totalLiquidity: 0n,
  totalClaims: { bondPrincipal: 1n, bondInterest: 9n,insurancePrincipal: 1n, insuranceInterest:  9n},
  totalDebtCreated: 0n,
  x: 100n,
  y: 100n,
  z: 100n,
}

const stateTest: StateTestParams = {
  asset: 100n,
  interest: 100n,
  cdp: 100n,
}

let lendMathTestContract: LendMathTest
let maturity: BigNumberish

const assetIn: bigint = 1000n
const interestDecrease: bigint = 30n
const cdpDecrease: bigint = 2n
const fee: bigint = 2n

describe('LendMath', () => {
  before(async () => {
    signers = await ethers.getSigners()
    maturity = (await now()) + 10000n
    const LendMathTestContractFactory = await ethers.getContractFactory('LendMathTest')
    lendMathTestContract = (await LendMathTestContractFactory.deploy()) as LendMathTest
    await lendMathTestContract.deployed()
  })

  it('Check should return true', async () => {
    const returnValue1 = await lendMathTestContract.check(state, assetIn, interestDecrease, cdpDecrease, fee)
    const returnValue2 = await LendMath.check(stateTest, assetIn, interestDecrease, cdpDecrease, fee)
    expect(returnValue1).to.be.true
    expect(returnValue2).to.be.true
    expect(returnValue1).to.equal(returnValue2)
  })
  it('GetBondInterest should return the expected bondOut', async () => {
    const returnValue1 = await lendMathTestContract.getBondInterest(maturity,  interestDecrease)
    let returnValue2 = await LendMath.getBondInterest(BigInt(maturity.toString()), assetIn, interestDecrease, await now())
    expect(returnValue1).to.be.equalBigInt(returnValue2)
  })

  it('GetInsurancePrincipal should return the expected InsuranceOut', async () => {
    const returnValue1 = await lendMathTestContract.getInsurancePrincipal(state, assetIn)
    let returnValue2 = await LendMath.getInsurancePrincipal(
      BigInt(maturity.toString()),
      stateTest,
      assetIn,
      interestDecrease,
      await now()
    )
    expect(returnValue1).to.be.equalBigInt(returnValue2)
  })
  it('GetInsuranceInterest should return the expected InsuranceOut', async () => {
    const returnValue1 = await lendMathTestContract.getInsuranceInterest(maturity, cdpDecrease)
    let returnValue2 = await LendMath.getInsuranceInterest(
      BigInt(maturity.toString()),
      stateTest,
      assetIn,
      interestDecrease,
      await now()
    )
    expect(returnValue1).to.be.equalBigInt(returnValue2)
  })
  it('Check should be reverted', async () => {
    const interestDecrease: bigint = 3n
    maturity = (await now()) + 10000n
    const LendMathTestContractFactory = await ethers.getContractFactory('LendMathTest')
    lendMathTestContract = (await LendMathTestContractFactory.deploy()) as LendMathTest
    await lendMathTestContract.deployed()
    await expect(lendMathTestContract.check(state, assetIn, interestDecrease, cdpDecrease, fee)).to.be.revertedWith(
      'E302'
    )
    expect(await LendMath.check(stateTest, assetIn, interestDecrease, cdpDecrease, fee)).to.be.false
  })
})
