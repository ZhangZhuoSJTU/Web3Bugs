import { ethers, waffle } from 'hardhat'
import { mulDiv, now, min, shiftRightUp, mulDivUp, advanceTimeAndBlock, setTime } from '../shared/Helper'
import { expect } from '../shared/Expect'
import * as LiquidityMath from '../libraries/LiquidityMath'
import * as LendMath from '../libraries/LendMath'
import { newLiquidityFixture, constructorFixture, Fixture, lendGivenBondFixture, collectFixture, collectETHAssetFixture, collectETHCollateralFixture, newLiquidityETHAssetFixture, lendGivenBondETHAssetFixture, newLiquidityETHCollateralFixture, lendGivenBondETHCollateralFixture } from '../shared/Fixtures'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import * as fc from 'fast-check'
import { LendGivenBondParams, NewLiquidityParams, CollectParams } from '../types'
import { Bond__factory, ERC20__factory, Insurance__factory, TestToken } from '../../typechain'
import * as LiquidityFilter from '../filters/Liquidity'
import * as LendFilter from '../filters/Lend'
import { Convenience } from '../shared/Convenience'

const { loadFixture } = waffle

let maturity = 0n
let signers: SignerWithAddress[] = []

const MAXUINT112: bigint = 2n ** 112n
async function fixture(): Promise<Fixture> {
  maturity = (await now()) + 31536000n
  signers = await ethers.getSigners()

  const constructor = await constructorFixture(1n << 255n, 1n << 255n, maturity, signers[0])

  return constructor
}

describe('Collect', () => {


  it('Succeeded', async () => {
    const { maturity,assetToken,collateralToken } = await loadFixture(fixture)
    let currentTime = await now()

    await fc.assert(
      fc.asyncProperty(
        fc
          .record({
            newLiquidityParams: fc
              .record({
                assetIn: fc.bigUintN(112),
                debtIn: fc.bigUintN(112),
                collateralIn: fc.bigUintN(112),
              })
              .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)),
            lendGivenBondParams: fc.record({
              assetIn: fc.bigUintN(112),
              bondOut: fc.bigUintN(112),
              minInsurance: fc.bigUintN(112),
            }),
            collectParams: fc.record({
                claims: fc.record({
                    bond: fc.bigUintN(112),
                    insurance: fc.bigUintN(112)
                })})

          })
          .filter((x) => LendFilter.lendGivenBondSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
          .filter((x)=> LendFilter.collectSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
          .noShrink(),
        async (data) => {
          const success = async () => {
            const constructor = await loadFixture(fixture)
            await setTime(Number(currentTime + 5000n))
            const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
            await setTime(Number(currentTime + 10000n))
            const lendGivenBond = await lendGivenBondFixture(newLiquidity, signers[0], data.lendGivenBondParams)
            await setTime(Number(maturity+1n))
            const collect = await collectFixture(lendGivenBond,signers[0],data.collectParams)
            return collect

          }
          await collectProperties(data,currentTime,success,assetToken.address,collateralToken.address)
        }),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
      )   

    }).timeout(100000)
  })

  describe('Collect ETHAsset', () => {

  
    it('Succeeded', async () => {
      const { maturity,assetToken,collateralToken, convenience } = await loadFixture(fixture)
      let currentTime = await now()
  
      await fc.assert(
        fc.asyncProperty(
          fc
            .record({
              newLiquidityParams: fc
                .record({
                  assetIn: fc.bigUintN(112),
                  debtIn: fc.bigUintN(112),
                  collateralIn: fc.bigUintN(112),
                })
                .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)),
              lendGivenBondParams: fc.record({
                assetIn: fc.bigUintN(112),
                bondOut: fc.bigUintN(112),
                minInsurance: fc.bigUintN(112),
              }),
              collectParams: fc.record({
                  claims: fc.record({
                      bond: fc.bigUintN(112),
                      insurance: fc.bigUintN(112)
                  })})
  
            })
            .filter((x) => LendFilter.lendGivenBondSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
            .filter((x)=> LendFilter.collectSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
            .noShrink(),
          async (data) => {
            const success = async () => {
              const constructor = await loadFixture(fixture)
              await setTime(Number(currentTime + 5000n))
              const newLiquidity = await newLiquidityETHAssetFixture(constructor, signers[0], data.newLiquidityParams)
              await setTime(Number(currentTime + 10000n))
              const lendGivenBond = await lendGivenBondETHAssetFixture(newLiquidity, signers[0], data.lendGivenBondParams)
              await setTime(Number(maturity+1n))
              const collect = await collectETHAssetFixture(lendGivenBond,signers[0],data.collectParams)
              return collect
  
            }
            await collectProperties(data,currentTime,success,convenience.wethContract.address,
              collateralToken.address)
          }),
        { skipAllAfterTimeLimit: 50000, numRuns: 10 }
        )
      }).timeout(100000)
    })
  
    describe('Collect ETHCollateral', () => {

    
      it('Succeeded', async () => {
        const { maturity,assetToken,collateralToken, convenience } = await loadFixture(fixture)
        let currentTime = await now()
    
        await fc.assert(
          fc.asyncProperty(
            fc
              .record({
                newLiquidityParams: fc
                  .record({
                    assetIn: fc.bigUintN(112),
                    debtIn: fc.bigUintN(112),
                    collateralIn: fc.bigUintN(112),
                  })
                  .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)),
                lendGivenBondParams: fc.record({
                  assetIn: fc.bigUintN(112),
                  bondOut: fc.bigUintN(112),
                  minInsurance: fc.bigUintN(112),
                }),
                collectParams: fc.record({
                    claims: fc.record({
                        bond: fc.bigUintN(112),
                        insurance: fc.bigUintN(112)
                    })})
    
              })
              .filter((x) => LendFilter.lendGivenBondSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
              .filter((x)=> LendFilter.collectSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
              .noShrink(),
            async (data) => {
              const success = async () => {
                const constructor = await loadFixture(fixture)
                await setTime(Number(currentTime + 5000n))
                const newLiquidity = await newLiquidityETHCollateralFixture(constructor, signers[0], data.newLiquidityParams)
                await setTime(Number(currentTime + 10000n))
                const lendGivenBond = await lendGivenBondETHCollateralFixture(newLiquidity, signers[0], data.lendGivenBondParams)
                await setTime(Number(maturity+1n))
                const collect = await collectETHCollateralFixture(lendGivenBond,signers[0],data.collectParams)
                return collect
    
              }
              await collectProperties(data,currentTime,success,assetToken.address,            convenience.wethContract.address)
            }),
          { skipAllAfterTimeLimit: 50000, numRuns: 10 }
          )
        }).timeout(100000)
      })
      async function collectProperties(
        data: {
          newLiquidityParams: {
            assetIn: bigint
            debtIn: bigint
            collateralIn: bigint
          }
          lendGivenBondParams: {
            assetIn: bigint,
            bondOut: bigint,
            minInsurance: bigint,
          },
          collectParams:{
              claims: {
                  bond: bigint,
                  insurance: bigint
              }}},

              
        currentTime: bigint,
        success: () => Promise<{
          convenience: Convenience
          assetToken: TestToken
          collateralToken: TestToken
          maturity: bigint
        }>,
        assetAddress: string,
        collateralAddress: string
      ) {
        
        const neededTime = (await now()) + 100n
        
      
        const result = await loadFixture(success)
      
        const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
          data.newLiquidityParams.assetIn,
          data.newLiquidityParams.debtIn,
          data.newLiquidityParams.collateralIn,
          currentTime + 5_000n,
          maturity
        )
      
        const state = {
          x: data.newLiquidityParams.assetIn,
          y: yIncreaseNewLiquidity,
          z: zIncreaseNewLiquidity,
        }
        const { yDecreaseLendGivenBond, zDecreaseLendGivenBond } = LendMath.calcYAndZDecreaseLendGivenBond(
          state,
          maturity,
          currentTime + 10_000n,
          data.lendGivenBondParams.assetIn,
          data.lendGivenBondParams.bondOut
        )
      
        const delState = {
          x: data.lendGivenBondParams.assetIn,
          y: yDecreaseLendGivenBond,
          z: zDecreaseLendGivenBond,
        }
      
        const bond = LendMath.getBond(delState, maturity, currentTime + 10_000n) - data.collectParams.claims.bond
        const insurance =LendMath.getInsurance(state, delState, maturity, currentTime + 10_000n) - data.collectParams.claims.insurance
      
        const natives = await result.convenience.getNatives(assetAddress, collateralAddress, maturity)
        const bondToken = Bond__factory.connect(natives.bond, ethers.provider)
        const insuranceToken = Insurance__factory.connect(natives.insurance,ethers.provider)

        
        const bondBalance = await bondToken.balanceOf(signers[0].address)
        const insuranceBalance = await insuranceToken.balanceOf(signers[0].address)
      
        expect(bondBalance).equalBigInt(bond)
        expect(insuranceBalance).equalBigInt(insurance)
      }
      