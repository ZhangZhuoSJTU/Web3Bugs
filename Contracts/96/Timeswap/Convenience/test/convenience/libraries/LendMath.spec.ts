
import { constructorFixture, Fixture, lendMathGivenBondFixture, lendMathGivenInsuranceFixture, lendMathGivenPercentFixture, mintMathCalleeGivenAssetFixture, mintMathCalleeGivenNewFixture, newLiquidityFixture } from '../../shared/Fixtures'
import * as fc from 'fast-check'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers, waffle } from 'hardhat'
import { now, setTime } from '../../shared/Helper'
import * as LiquidityFilter from '../../filters/Liquidity'
import * as LiquidityMath from '../../libraries/LiquidityMath'
import * as LendFilter from '../../filters/Lend'
import * as LendMath from '../../libraries/LendMath'
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
describe('Lend Math Given Bond', () => {
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
              lendGivenBondParams: fc.record({
                assetIn: fc.bigUintN(112),
                bondOut: fc.bigUintN(112),
                minInsurance: fc.bigUintN(112),
              }),
            })
            .filter((x) => LendFilter.lendGivenBondSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
          async (data) => {
            const success = async () => {
              const constructor = await loadFixture(fixture)
              await setTime(Number(currentTime + 5000n))
              const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
              await setTime(Number(currentTime + 10000n))
              const lendGivenBond = await lendMathGivenBondFixture(newLiquidity, signers[0], data.lendGivenBondParams)
              return lendGivenBond
            }
            const [yDecrease,zDecrease] = (await loadFixture(success)).map((x)=>x.toBigInt())
            await lendMathGivenBondProperties(data, currentTime, maturity,yDecrease,zDecrease)
          }
        ),
        { skipAllAfterTimeLimit: 50000, numRuns: 10 }
      )
    }).timeout(100000)
  

  })
  describe('Lend Math Given Insurance', () => {
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
              lendGivenInsuranceParams: fc.record({
                assetIn: fc.bigUintN(112),
                insuranceOut: fc.bigUintN(112),
                minBond: fc.bigUintN(112),
              }),
            })
            .filter((x) => LendFilter.lendGivenInsuranceSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
            .noShrink(),
          async (data) => {
            const success = async () => {
              const constructor = await loadFixture(fixture)
              await setTime(Number(currentTime + 5000n))
              const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
              await setTime(Number(currentTime + 10000n))
              const lendGivenBond = await lendMathGivenInsuranceFixture(
                newLiquidity,
                signers[0],
                data.lendGivenInsuranceParams
              )
              return lendGivenBond
            }
  
            const [yDecrease,zDecrease] = (await loadFixture(success)).map((x)=>x.toBigInt())
            await lendMathGivenInsuranceProperties(data, currentTime, maturity,yDecrease,zDecrease)
          }
        ),
        { skipAllAfterTimeLimit: 50000, numRuns: 5 }
      )
    }).timeout(100000)
})
describe('Lend Math Given Percent', () => {
  async function fixture(): Promise<Fixture> {
    maturity = (await now()) + 31536000n
    signers = await ethers.getSigners()

    const constructor = await constructorFixture(1n << 255n, 1n << 255n, maturity, signers[0])

    return constructor
  }

  it('Succeeded', async () => {
    const { maturity } = await loadFixture(fixture)
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
            lendGivenPercentParams: fc.record({
              assetIn: fc.bigUintN(50),
              percent: fc.bigUint(1n<<32n),
              minInsurance: fc.bigUintN(50),
              minBond: fc.bigUintN(50)
            }),
          })
          .filter((x) => LendFilter.lendGivenPercentSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
          .noShrink(),
        async (data) => {
          const success = async () => {
            const constructor = await loadFixture(fixture)
            await setTime(Number(currentTime + 5000n))
            const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
            await setTime(Number(currentTime + 10000n))
            const lendGivenBond = await lendMathGivenPercentFixture(newLiquidity, signers[0], data.lendGivenPercentParams)
            return lendGivenBond
          }
          
          
          
          const [yDecrease,zDecrease] = (await loadFixture(success)).map((x)=>x.toBigInt())
          await lendMathGivenPercentProperties(data, currentTime, maturity,yDecrease,zDecrease)

          
        }),
      { skipAllAfterTimeLimit: 50000, numRuns:10 }
    )
  }).timeout(100000)
})
  async function lendMathGivenBondProperties(
    data: {
      newLiquidityParams: {
        assetIn: bigint
        debtIn: bigint
        collateralIn: bigint
      }
      lendGivenBondParams: {
        assetIn: bigint
        bondOut: bigint
        minInsurance: bigint
      }
    },
    currentTime: bigint,
    maturity:bigint,
    yDecrease: bigint,
    zDecrease: bigint
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
    const { yDecreaseLendGivenBond, zDecreaseLendGivenBond } = LendMath.calcYAndZDecreaseLendGivenBond(
      state,
      maturity,
      currentTime + 10_000n,
      data.lendGivenBondParams.assetIn,
      data.lendGivenBondParams.bondOut
    )
    expect(yDecrease).equalBigInt(yDecreaseLendGivenBond)
    expect(zDecrease).equalBigInt(zDecreaseLendGivenBond)
  }
  
async function lendMathGivenInsuranceProperties(
    data: {
      newLiquidityParams: {
        assetIn: bigint
        debtIn: bigint
        collateralIn: bigint
      }
      lendGivenInsuranceParams: {
        assetIn: bigint
        insuranceOut: bigint
        minBond: bigint
      }
    },
    currentTime: bigint,
    maturity:bigint,
    yDecrease: bigint,
    zDecrease: bigint
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
    const { yDecreaseLendGivenInsurance, zDecreaseLendGivenInsurance } = LendMath.calcYAndZDecreaseLendGivenInsurance(
      state,
      maturity,
      currentTime + 10_000n,
      data.lendGivenInsuranceParams.assetIn,
      data.lendGivenInsuranceParams.insuranceOut
    )
    expect(yDecrease).equalBigInt(yDecreaseLendGivenInsurance)
    expect(zDecrease).equalBigInt(zDecreaseLendGivenInsurance)
  }
  async function lendMathGivenPercentProperties(
    data: {
      newLiquidityParams: {
        assetIn: bigint
        debtIn: bigint
        collateralIn: bigint
      }
      lendGivenPercentParams: {
        assetIn: bigint
        percent: bigint
        minBond: bigint
        minInsurance: bigint
      }
    },
    currentTime: bigint,
    maturity:bigint,
    yDecrease: bigint,
    zDecrease: bigint
  ) {
  
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
  const { yDecreaseLendGivenPercent, zDecreaseLendGivenPercent } = LendMath.calcYAndZDecreaseLendGivenPercent(
    state,
    maturity,
    currentTime + 10_000n,
    data.lendGivenPercentParams.assetIn,
    data.lendGivenPercentParams.percent
  )
  expect(yDecrease).equalBigInt(yDecreaseLendGivenPercent)
  expect(zDecrease).equalBigInt(zDecreaseLendGivenPercent)
}