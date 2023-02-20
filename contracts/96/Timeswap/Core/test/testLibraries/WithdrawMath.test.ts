import chai from 'chai'
import { ethers, waffle } from 'hardhat'
import { WithdrawMathTest } from '../../typechain/WithdrawMathTest'
import WithdrawMath from '../libraries/WithdrawMath'
import { expect } from '../shared/Expect'

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
  reserves: Token
  totalLiquidity: bigint
  totalClaims: Claims
  totalDebtCreated: bigint
  asset: bigint
  interest: bigint
  cdp: bigint
}

const state: StateParams = {
  reserves: { asset: 0n, collateral: 0n },
  totalLiquidity: 0n,
  totalClaims: { bondPrincipal: 0n, bondInterest:0n,insuranceInterest: 0n, insurancePrincipal:0n  },
  totalDebtCreated: 0n,
  x: 5000n,
  y: 10000n,
  z: 10000n,
}

const stateTest: StateTestParams = {
  reserves: { asset: 0n, collateral: 0n },
  totalLiquidity: 0n,
  totalClaims: { bondPrincipal: 0n, bondInterest:0n,insuranceInterest: 0n, insurancePrincipal:0n },
  totalDebtCreated: 0n,
  asset: 5000n,
  interest: 10000n,
  cdp: 10000n,
}

let WithdrawMathTestContract: WithdrawMathTest

const bondPrincipal: bigint = 10n
const bondInterest: bigint = 100n
const insurancePrincipal: bigint = 10n
const insuranceInterest: bigint = 30n

describe('Withdraw Math', () => {
  before(async () => {
    const WithdrawMathTestContractFactory = await ethers.getContractFactory('WithdrawMathTest')
    WithdrawMathTestContract = (await WithdrawMathTestContractFactory.deploy()) as WithdrawMathTest
    await WithdrawMathTestContract.deployed()
  })

  it('getAsset should return the expected asset out', async () => {
    const returnValue1 = await WithdrawMathTestContract.getAsset(state, bondPrincipal,bondInterest)
    let returnValue2 = await WithdrawMath.getAsset(stateTest, bondPrincipal,bondInterest)
    expect(returnValue1).to.equalBigInt(returnValue2)
  })

  it('getCollateral should return the expected collateral out', async () => {
    const returnValue1 = await WithdrawMathTestContract.getCollateral(state, insurancePrincipal,insuranceInterest)
    let returnValue2 = await WithdrawMath.getCollateral(stateTest, insurancePrincipal,insuranceInterest)
    expect(returnValue1).to.equalBigInt(returnValue2)
  })
})
