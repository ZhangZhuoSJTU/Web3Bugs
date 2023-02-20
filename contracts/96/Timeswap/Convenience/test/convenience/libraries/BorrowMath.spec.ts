
import { borrowMathGivenCollateralFixture, borrowMathGivenDebtFixture, borrowMathGivenPercentFixture, constructorFixture, Fixture, lendMathGivenBondFixture, lendMathGivenInsuranceFixture, lendMathGivenPercentFixture, mintMathCalleeGivenAssetFixture, mintMathCalleeGivenNewFixture, newLiquidityFixture } from '../../shared/Fixtures'
import * as fc from 'fast-check'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers, waffle } from 'hardhat'
import { now, setTime } from '../../shared/Helper'
import * as LiquidityFilter from '../../filters/Liquidity'
import * as LiquidityMath from '../../libraries/LiquidityMath'
import * as BorrowFilter from '../../filters/Borrow'
import * as BorrowMath from '../../libraries/BorrowMath'
import { expect } from '../../shared/Expect'

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


describe('Borrow Math Given Debt', () => {
    it('Succeeded', async () => {
      const { maturity, assetToken, collateralToken } = await loadFixture(fixture)
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
              borrowGivenDebtParams: fc.record({
                assetOut: fc.bigUintN(112),
                debtIn: fc.bigUintN(112),
                maxCollateral: fc.bigUintN(112),
              }),
            })
            .filter((x) => BorrowFilter.borrowGivenDebtSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
            .noShrink(),
          async (data) => {
            const success = async () => {
              const constructor = await loadFixture(fixture)
              await setTime(Number(currentTime + 5000n))
              const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
              await setTime(Number(currentTime + 10000n))
              const borrowGivenDebt = await borrowMathGivenDebtFixture(newLiquidity, signers[0], data.borrowGivenDebtParams)
              return borrowGivenDebt
            }
            const [yIncrease,zIncrease] = (await loadFixture(success)).map((x)=>x.toBigInt())
            await borrowMathGivenDebtProperties(data, currentTime,maturity,yIncrease,zIncrease)
          }
        )
        ,
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
      )
  
    }).timeout(600000)
  })
  
describe('BorrowMath  Given Collateral', () => {
    it('Succeeded', async () => {
      const { maturity, assetToken, collateralToken } = await loadFixture(fixture)
      let currentTime = await now()
  
      await fc.assert(
        fc.asyncProperty(
          fc
            .record({
              newLiquidityParams: fc
                .record({
                  assetIn: fc.bigUintN(50),
                  debtIn: fc.bigUintN(50),
                  collateralIn: fc.bigUintN(50),
                })
                .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)),
              borrowGivenCollateralParams: fc.record({
                assetOut: fc.bigUintN(50),
                collateralIn: fc.bigUintN(50),
                maxDebt: fc.bigUintN(50),
              }),
            })
            .filter((x) =>
              BorrowFilter.borrowGivenCollateralSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)
            )
            .noShrink(),
          async (data) => {
            const success = async () => {
              const constructor = await loadFixture(fixture)
              await setTime(Number(currentTime + 5000n))
              const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
              await setTime(Number(currentTime + 10000n))
              const borrowGivenCollateral = await borrowMathGivenCollateralFixture(
                newLiquidity,
                signers[0],
                data.borrowGivenCollateralParams
              )
              return borrowGivenCollateral
            }
            const [yIncrease,zIncrease] = (await loadFixture(success)).map((x)=>x.toBigInt())
            await borrowMathGivenCollateralProperties(data, currentTime,maturity,yIncrease,zIncrease)
          }
        ),       { skipAllAfterTimeLimit: 50000, numRuns: 10 }
  
      )
    }).timeout(600000)
  })
  
describe('Borrow Math Given Percent', () => {
    it('Succeeded', async () => {
      const { maturity, assetToken, collateralToken } = await loadFixture(fixture)
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
              borrowGivenPercentParams: fc.record({
                assetOut: fc.bigUintN(112),
                percent: fc.bigUint(1n << 32n),
                maxDebt: fc.bigUintN(112),
                maxCollateral: fc.bigUintN(112),
              }),
            })
            .filter((x) =>
              BorrowFilter.borrowGivenPercentSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)
            ),
          async (data) => {
            const success = async () => {
              const constructor = await loadFixture(fixture)
              await setTime(Number(currentTime + 5000n))
              const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
              await setTime(Number(currentTime + 10000n))
              const borrowGivenPercent = await borrowMathGivenPercentFixture(
                newLiquidity,
                signers[0],
                data.borrowGivenPercentParams
              )
              return borrowGivenPercent
            }
            const [yIncrease,zIncrease] = (await loadFixture(success)).map((x)=>x.toBigInt())
            await borrowMathGivenPercentProperties(data, currentTime, maturity,yIncrease,zIncrease)
          }
        )
        ,{ skipAllAfterTimeLimit: 50000, numRuns: 10 }
      )      
  
    }).timeout(600000)
  })
  
async function borrowMathGivenDebtProperties(
    data: {
      newLiquidityParams: {
        assetIn: bigint
        debtIn: bigint
        collateralIn: bigint
      }
      borrowGivenDebtParams: {
        assetOut: bigint
        debtIn: bigint
        maxCollateral: bigint
      }
    },
    currentTime: bigint,
    maturity:bigint,
    yIncrease: bigint,
    zIncrease: bigint
  ) {
    
    const neededTime = (await now()) + 100n
    
  
    
  
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
    const { yIncreaseBorrowGivenDebt, zIncreaseBorrowGivenDebt } = BorrowMath.getYandZIncreaseBorrowGivenDebt(
      state,
      data.borrowGivenDebtParams.assetOut,
      maturity,
      currentTime + 10_000n,
      data.borrowGivenDebtParams.debtIn
    )
        expect(yIncrease).equalBigInt(yIncreaseBorrowGivenDebt)
        expect(zIncrease).equalBigInt(zIncreaseBorrowGivenDebt)
  }
  
async function borrowMathGivenCollateralProperties(
    data: {
      newLiquidityParams: {
        assetIn: bigint
        debtIn: bigint
        collateralIn: bigint
      }
      borrowGivenCollateralParams: {
        assetOut: bigint
        collateralIn: bigint
        maxDebt: bigint
      }
    },
    currentTime: bigint,
    maturity:bigint,
    yIncrease: bigint,
    zIncrease: bigint
  ) {
    
    const neededTime = (await now()) + 100n
    
  
    
  
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
    const { yIncreaseBorrowGivenCollateral, zIncreaseBorrowGivenCollateral } =
      BorrowMath.getYandZIncreaseBorrowGivenCollateral(
        state,
        data.borrowGivenCollateralParams.assetOut,
        maturity,
        currentTime + 10_000n,
        data.borrowGivenCollateralParams.collateralIn
      )
    
    expect(yIncrease).equalBigInt(yIncreaseBorrowGivenCollateral)
    expect(zIncrease).equalBigInt(zIncreaseBorrowGivenCollateral)
  }
  
async function borrowMathGivenPercentProperties(
    data: {
      newLiquidityParams: {
        assetIn: bigint
        debtIn: bigint
        collateralIn: bigint
      }
      borrowGivenPercentParams: {
        assetOut: bigint
        percent: bigint
        maxDebt: bigint
        maxCollateral: bigint
      }
    },
    currentTime: bigint,
    maturity:bigint,
    yIncrease: bigint,
    zIncrease: bigint
  ) {
    
    const neededTime = (await now()) + 100n
    
  
    
  
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
    const { yIncreaseBorrowGivenPercent, zIncreaseBorrowGivenPercent } = BorrowMath.getYandZIncreaseBorrowGivenPercent(
      state,
      data.borrowGivenPercentParams.assetOut,
      data.borrowGivenPercentParams.percent
    )
    expect(yIncrease).equalBigInt(yIncreaseBorrowGivenPercent)
    expect(zIncrease).equalBigInt(zIncreaseBorrowGivenPercent)  
  }
  