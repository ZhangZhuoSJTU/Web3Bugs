import { BigNumberish } from '@ethersproject/bignumber'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import { ethers, waffle } from 'hardhat'
import { MintMathTest } from '../../typechain/MintMathTest'
import MintMath from '../libraries/MintMath'
import { PROTOCOL_FEE } from '../shared/Constants'
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
  totalLiquidity: 50n,
  totalClaims: { bondPrincipal: 0n, bondInterest:0n,insuranceInterest: 0n, insurancePrincipal:0n },
  totalDebtCreated: 0n,
  x: 100n,
  y: 10n,
  z: 1n,
}

const stateTest: StateTestParams = {
  reserves: { asset: 0n, collateral: 0n },
  totalLiquidity: 50n,
  totalClaims: { bondPrincipal: 0n, bondInterest:0n,insuranceInterest: 0n, insurancePrincipal:0n },
  totalDebtCreated: 0n,
  asset: 100n,
  interest: 10n,
  cdp: 1n,
}

let MintMathTestContract: MintMathTest
let maturity: BigNumberish

const assetIn: bigint = 1000n
const interestIncrease: bigint = 30n
const cdpIncrease: bigint = 2n
const fee: bigint = 2n

describe('MintMath', () => {
  before(async () => {
    signers = await ethers.getSigners()
    maturity = (await now()) + 10000n
    const MintMathTestContractFactory = await ethers.getContractFactory('MintMathTest')
    MintMathTestContract = (await MintMathTestContractFactory.deploy()) as MintMathTest
    await MintMathTestContract.deployed()
  })

  it('Getting LiquidityTotal for AssetIn', async () => {
    expect(await MintMathTestContract.getLiquidity1(assetIn)).to.be.equalBigInt(
      await MintMath.getLiquidity1(assetIn)
    )
  })


  // it('Getting expected Liquidity', async () => {

  //   const expectedLiquidity =await MintMath.getLiquidity2(
  //     state,
  //     assetIn,
  //     interestIncrease,
  //     cdpIncrease
  //   )

  //   expect(await MintMathTestContract.getLiquidity2(state,maturity, liquitidyTotal, PROTOCOL_FEE)).to.be.equalBigInt(
  //     expectedLiquidity
  //   )
  // })

  it('Getting expected Debt', async () => {
    expect((await MintMathTestContract.getDebt(maturity, assetIn, interestIncrease)).toString()).to.be.equalBigInt(
      await MintMath.getDebt(BigInt(maturity.toString()), assetIn, interestIncrease, await now())
    )
  })

  it('Getting expected Collateral', async () => {
    expect((await MintMathTestContract.getCollateral(maturity, cdpIncrease)).toString()).to.be.equalBigInt(
      await MintMath.getCollateral(BigInt(maturity.toString()), assetIn, interestIncrease, cdpIncrease, await now())
    )
  })
})
