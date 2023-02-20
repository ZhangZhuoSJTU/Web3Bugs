import { ethers, waffle } from 'hardhat'
import { mulDiv, now, min, shiftRightUp, mulDivUp, advanceTimeAndBlock, setTime } from '../shared/Helper'
import { expect } from '../shared/Expect'
import * as LiquidityMath from '../libraries/LiquidityMath'
import * as LendMath from '../libraries/LendMath'
import {
  newLiquidityFixture,
  constructorFixture,
  Fixture,
  lendGivenBondFixture,
  lendGivenInsuranceFixture,
  lendGivenInsuranceETHCollateralFixture,
  newLiquidityETHCollateralFixture,
  lendGivenInsuranceETHAssetFixture,
  newLiquidityETHAssetFixture,
} from '../shared/Fixtures'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import * as fc from 'fast-check'
import { LendGivenInsuranceParams, NewLiquidityParams } from '../types'
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

describe('Lend Given Insurance', () => {
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
            const lendGivenBond = await lendGivenInsuranceFixture(
              newLiquidity,
              signers[0],
              data.lendGivenInsuranceParams
            )
            return lendGivenBond
          }

          await lendGivenInsuranceProperties(data, currentTime, success, assetToken.address, collateralToken.address)
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 5 }
    )
  }).timeout(100000)

  it('Failed', async () => {
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
          .filter(
            (x) => !LendFilter.lendGivenInsuranceSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)
          )
          .map((x) => LendFilter.lendGivenInsuranceError(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
          .noShrink(),
        async ({ data, error }) => {
          const constructor = await loadFixture(fixture)
          await setTime(Number(currentTime + 5000n))
          await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
          await setTime(Number(currentTime + 10000n))

          await expect(
            constructor.convenience.convenienceContract.lendGivenInsurance({
              asset: assetToken.address,
              collateral: collateralToken.address,
              maturity,
              bondTo: signers[0].address,
              insuranceTo: signers[0].address,
              assetIn: data.lendGivenInsuranceParams.assetIn,
              insuranceOut: data.lendGivenInsuranceParams.insuranceOut,
              minBond: data.lendGivenInsuranceParams.minBond,
              deadline: maturity,
            })
          ).to.be.revertedWith('')
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(100000)
})

describe('Lend Given Insurance ETH Asset', () => {
  it('Succeeded', async () => {
    const { maturity, convenience, collateralToken } = await loadFixture(fixture)
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
            const newLiquidity = await newLiquidityETHAssetFixture(constructor, signers[0], data.newLiquidityParams)
            await setTime(Number(currentTime + 10000n))
            const lendGivenBond = await lendGivenInsuranceETHAssetFixture(
              newLiquidity,
              signers[0],
              data.lendGivenInsuranceParams
            )
            return lendGivenBond
          }

          await lendGivenInsuranceProperties(
            data,
            currentTime,
            success,
            convenience.wethContract.address,
            collateralToken.address
          )
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 5 }
    )
  }).timeout(100000)

  it('Failed', async () => {
    const { maturity, collateralToken } = await loadFixture(fixture)
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
          .filter(
            (x) => !LendFilter.lendGivenInsuranceSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)
          )
          .map((x) => LendFilter.lendGivenInsuranceError(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
          .noShrink(),
        async ({ data, error }) => {
          const constructor = await loadFixture(fixture)
          await setTime(Number(currentTime + 5000n))
          await newLiquidityETHAssetFixture(constructor, signers[0], data.newLiquidityParams)
          await setTime(Number(currentTime + 10000n))

          await expect(
            constructor.convenience.convenienceContract.lendGivenInsuranceETHAsset(
              {
                collateral: collateralToken.address,
                maturity,
                bondTo: signers[0].address,
                insuranceTo: signers[0].address,
                insuranceOut: data.lendGivenInsuranceParams.insuranceOut,
                minBond: data.lendGivenInsuranceParams.minBond,
                deadline: maturity,
              },
              { value: data.lendGivenInsuranceParams.assetIn }
            )
          ).to.be.revertedWith('')
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 } 
    )
  }).timeout(100000)
})

describe('Lend Given Insurance ETH Collateral', () => {
  it('Succeeded', async () => {
    const { maturity, assetToken, convenience } = await loadFixture(fixture)
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
            const newLiquidity = await newLiquidityETHCollateralFixture(
              constructor,
              signers[0],
              data.newLiquidityParams
            )
            await setTime(Number(currentTime + 10000n))
            const lendGivenBond = await lendGivenInsuranceETHCollateralFixture(
              newLiquidity,
              signers[0],
              data.lendGivenInsuranceParams
            )
            return lendGivenBond
          }

          await lendGivenInsuranceProperties(
            data,
            currentTime,
            success,
            assetToken.address,
            convenience.wethContract.address
          )
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 5 }
    )
  }).timeout(100000)

  it('Failed', async () => {
    const { maturity, assetToken } = await loadFixture(fixture)
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
          .filter(
            (x) => !LendFilter.lendGivenInsuranceSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)
          )
          .map((x) => LendFilter.lendGivenInsuranceError(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
          .noShrink(),
        async ({ data, error }) => {
          const constructor = await loadFixture(fixture)
          await setTime(Number(currentTime + 5000n))
          await newLiquidityETHCollateralFixture(constructor, signers[0], data.newLiquidityParams)
          await setTime(Number(currentTime + 10000n))

          await expect(
            constructor.convenience.convenienceContract.lendGivenInsuranceETHCollateral({
              asset: assetToken.address,
              maturity,
              bondTo: signers[0].address,
              insuranceTo: signers[0].address,
              assetIn: data.lendGivenInsuranceParams.assetIn,
              insuranceOut: data.lendGivenInsuranceParams.insuranceOut,
              minBond: data.lendGivenInsuranceParams.minBond,
              deadline: maturity,
            })
          ).to.be.revertedWith('')
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(100000)
})

async function lendGivenInsuranceProperties(
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
  const { yDecreaseLendGivenInsurance, zDecreaseLendGivenInsurance } = LendMath.calcYAndZDecreaseLendGivenInsurance(
    state,
    maturity,
    currentTime + 10_000n,
    data.lendGivenInsuranceParams.assetIn,
    data.lendGivenInsuranceParams.insuranceOut
  )

  const delState = {
    x: data.lendGivenInsuranceParams.assetIn,
    y: yDecreaseLendGivenInsurance,
    z: zDecreaseLendGivenInsurance,
  }
  const bond = LendMath.getBond(delState, maturity, currentTime + 10_000n)
  const insurance = LendMath.getInsurance(state, delState, maturity, currentTime + 10_000n)

  const natives = await result.convenience.getNatives(assetAddress, collateralAddress, result.maturity)

  const bondToken = Bond__factory.connect(natives.bond, ethers.provider)
  const insuranceToken = Insurance__factory.connect(natives.insurance, ethers.provider)

  const bondContractBalance = (await bondToken.balanceOf(signers[0].address)).toBigInt()
  const insuranceContractBalance = (await insuranceToken.balanceOf(signers[0].address)).toBigInt()

  expect(bondContractBalance).equalBigInt(bond)
  expect(insuranceContractBalance).equalBigInt(insurance)

  // expect(insurance).gteBigInt(data.lendGivenInsuranceParams.insuranceOut)
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
}
