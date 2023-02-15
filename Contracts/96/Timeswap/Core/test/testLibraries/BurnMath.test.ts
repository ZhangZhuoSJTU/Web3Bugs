import chai from 'chai'
import { ethers, waffle } from 'hardhat'
import { BurnMathTest } from '../../typechain/BurnMathTest'
import BurnMath from '../libraries/BurnMath'
import { expect } from '../shared/Expect'

const { solidity } = waffle
chai.use(solidity)

interface Token {
  asset: bigint
  collateral: bigint
}
export interface Claims {
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
  reserves: Token
  totalLiquidity: bigint
  totalClaims: Claims
  totalDebtCreated: bigint
  asset: bigint
  interest: bigint
  cdp: bigint
}

const state: StateParams = {
  reserves: { asset: 10n, collateral: 10n },
  totalLiquidity: 10n,
  totalClaims: { bondPrincipal: 1n, bondInterest: 9n,insurancePrincipal: 1n, insuranceInterest:  9n},
  totalDebtCreated: 10n,
  x: 100n,
  y: 100n,
  z: 100n,
}

const stateTest: StateTestParams = {
  reserves: { asset: 10n, collateral: 10n },
  totalLiquidity: 10n,
  totalClaims: { bondPrincipal: 1n,bondInterest: 9n, insurancePrincipal: 1n , insuranceInterest: 9n},
  totalDebtCreated: 10n,
  asset: 100n,
  interest: 100n,
  cdp: 100n,
}

let burnMathTestContract: BurnMathTest

const liquidityIn: bigint = 100n

describe('BurnMath', () => {
  before(async () => {
    const BurnMathTestContractFactory = await ethers.getContractFactory('BurnMathTest')
    burnMathTestContract = (await BurnMathTestContractFactory.deploy()) as BurnMathTest
    await burnMathTestContract.deployed()
  })

  it('GetAsset should return the expected assetOut', async () => {
    const returnValue1 = await burnMathTestContract.getAsset(state, liquidityIn)
    let returnValue2 = await BurnMath.getAsset(stateTest, liquidityIn)
    expect(returnValue1).to.be.equalBigInt(returnValue2)
  })

  it('GetCollateral should return the expected collateralout', async () => {
    const returnValue1 = await burnMathTestContract.getCollateral(state, liquidityIn)
    let returnValue2 = await BurnMath.getCollateral(stateTest, liquidityIn)
    expect(returnValue1).to.be.equalBigInt(returnValue2)
  })
})
