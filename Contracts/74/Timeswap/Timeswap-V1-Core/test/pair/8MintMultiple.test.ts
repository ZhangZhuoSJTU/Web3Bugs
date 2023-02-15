import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Decimal } from 'decimal.js'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { expect } from '../shared/Expect'
import { constructorFixture, mintFixture } from '../shared/Fixtures'
import { now } from '../shared/Helper'
import * as TestCases from '../testCases'
import { MintParams } from '../testCases'

Decimal.config({ toExpNeg: 0, toExpPos: 500 })

const MaxUint224 = BigNumber.from(2).pow(224).sub(1)
let signers: SignerWithAddress[]
let assetInValue: bigint = BigInt(MaxUint224.toString()) // creating ERC20 with this number
let collateralInValue: bigint = BigInt(MaxUint224.toString())

describe('MintMultiple', () => {
  let testCases: any = []
  let snapshot: any

  before(async () => {
    snapshot = await ethers.provider.send('evm_snapshot', [])
  })

  it('', async () => {
    let testCases1 = await TestCases.mint()
    let testCases2 = await TestCases.mint()
    for (let i = 0; i < testCases1.length; i++) {
      testCases[i] = [testCases1[i], testCases2[i]]
      let testCase1: any = testCases[i][0]
      let testCase2: any = testCases[i][1]
      await ethers.provider.send('evm_revert', [snapshot])
      await ethers.provider.send('evm_snapshot', [])
      signers = await ethers.getSigners()
      let pair: any
      let pairSim: any
      let updatedMaturity: any
      console.log('\n', `Checking for Multiple Mint Test Case ${i + 1}`)
      const currentBlockTime = (await now()) + 31556952n
      updatedMaturity = currentBlockTime
      const constructor = await constructorFixture(assetInValue, collateralInValue, updatedMaturity)
      const mintParams: MintParams[] = [
        {
          assetIn: testCase1.assetIn,
          collateralIn: testCase1.collateralIn,
          interestIncrease: testCase1.interestIncrease,
          cdpIncrease: testCase1.cdpIncrease,
          maturity: updatedMaturity,
          currentTimeStamp: testCase1.currentTimeStamp,
        },
        {
          assetIn: testCase2.assetIn,
          collateralIn: testCase2.collateralIn,
          interestIncrease: testCase2.interestIncrease,
          cdpIncrease: testCase2.cdpIncrease,
          maturity: updatedMaturity,
          currentTimeStamp: testCase2.currentTimeStamp,
        },
      ]
      let mint1: any
      try {
        mint1 = await mintFixture(constructor, signers[0], mintParams[0])
        pair = mint1.pair
        pairSim = mint1.pairSim
      } catch (error) {
        console.log('there was an error in Mint 1')
        continue
      }
      let mint2: any
      try {
        mint2 = await mintFixture(mint1, signers[0], mintParams[1])
        pair = mint2.pair
        pairSim = mint2.pairSim
      } catch (error) {
        console.log(`Case number: ${i + 1} expected to fail at second mint`)
        await expect(
          pair.pairContractCallee
            .connect(signers[0])
            .mint(
              pair.maturity,
              signers[0].address,
              mintParams[1].assetIn,
              mintParams[1].interestIncrease,
              mintParams[1].cdpIncrease
            )
        ).to.be.reverted
        console.log('Tx reverted successfully')
        continue
      }
      console.log(`Case number: ${i + 1} expected to succeed`)
      console.log(`Testing for Mint Success Case ${i + 1}`)
      console.log('Should have correct reserves')
      const reserves = await pair.totalReserves()
      const reservesSim = pairSim.getPool(updatedMaturity).state.reserves
      expect(reserves.asset).to.equalBigInt(reservesSim.asset)
      expect(reserves.collateral).to.equalBigInt(reservesSim.collateral)

      console.log('Should have correct state')
      const state = await pair.state()
      const stateSim = pairSim.getPool(updatedMaturity).state
      expect(state.asset).to.equalBigInt(stateSim.asset)
      expect(state.interest).to.equalBigInt(stateSim.interest)
      expect(state.cdp).to.equalBigInt(stateSim.cdp)

      console.log('Should have correct total liquidity')
      const liquidity = await pair.totalLiquidity()
      const liquiditySim = pairSim.getPool(updatedMaturity).state.totalLiquidity
      expect(liquidity).to.equalBigInt(liquiditySim)

      console.log('Should have correct liquidity of')
      const liquidityOf = await pair.liquidityOf(signers[0])
      const liquidityOfSim = pairSim.getLiquidity(pairSim.getPool(updatedMaturity), signers[0].address)
      expect(liquidityOf).to.equalBigInt(liquidityOfSim)

      console.log('Should have correct total debt')

      const totalDebtCreated = await pair.totalDebtCreated()
      const totalDebtCreatedSim = pairSim.getPool(updatedMaturity).state.totalDebtCreated
      expect(totalDebtCreated).to.equalBigInt(totalDebtCreatedSim)

      console.log('Should have correct total claims')
      const claims = await pair.totalClaims()
      const claimsSim = pairSim.getPool(updatedMaturity).state.totalClaims
      expect(claims.bond).to.equalBigInt(claimsSim.bond)
      expect(claims.insurance).to.equalBigInt(claimsSim.insurance)

      console.log('Should have correct claims of')

      const claimsOf = await pair.claimsOf(signers[0])
      const claimsOfSim = pairSim.getClaims(pairSim.getPool(updatedMaturity), signers[0].address)
      expect(claimsOf.bond).to.equalBigInt(claimsOfSim.bond)
      expect(claimsOf.insurance).to.equalBigInt(claimsOfSim.insurance)

      console.log('Should have correct dues of')
      const duesOf = (await pair.dueOf(0n)).concat(await pair.dueOf(1n))
      const duesOfSim = pairSim.getDues(pairSim.getPool(updatedMaturity), signers[0].address).due
      expect(duesOf.length).to.equal(duesOfSim.length)
      for (let i = 0; i < duesOf.length; i++) {
        expect(duesOf[i].collateral).to.equalBigInt(duesOfSim[i].collateral)
        expect(duesOf[i].debt).to.equalBigInt(duesOfSim[i].debt)
        expect(duesOf[i].startBlock).to.equalBigInt(duesOfSim[i].startBlock)
      }
    }
  })
})
