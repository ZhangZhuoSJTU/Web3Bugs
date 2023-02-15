import { ethers, waffle } from 'hardhat'
import { mulDiv, now, min, shiftRightUp, mulDivUp, advanceTimeAndBlock, setTime } from '../shared/Helper'
import { expect } from '../shared/Expect'
import * as LiquidityMath from '../libraries/LiquidityMath'
import * as BorrowMath from '../libraries/BorrowMath'
import {
  newLiquidityFixture,
  constructorFixture,
  Fixture,
  liquidityGivenAssetFixture,
  borrowGivenCollateralFixture,
  borrowGivenCollateralETHAssetFixture,
  newLiquidityETHAssetFixture,
  borrowGivenCollateralETHCollateralFixture,
  newLiquidityETHCollateralFixture,
} from '../shared/Fixtures'

import * as fc from 'fast-check'
import { AddLiquidityGivenAssetParams, NewLiquidityParams } from '../types'
import { CollateralizedDebt__factory, ERC20__factory, TestToken } from '../../typechain'
import * as LiquidityFilter from '../filters/Liquidity'
import * as BorrowFilter from '../filters/Borrow'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Convenience } from '../shared/Convenience'

const { loadFixture } = waffle

let maturity = 0n
let signers: SignerWithAddress[] = []

const MAXUINT112: bigint = 2n ** 112n

async function fixture(): Promise<Fixture> {
  maturity = (await now()) + 31536000n
  signers = await ethers.getSigners()

  const constructor = await constructorFixture(1n << 150n, 1n << 150n, maturity, signers[0])

  return constructor
}

describe('Borrow Given Collateral', () => {
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
            const borrowGivenCollateral = await borrowGivenCollateralFixture(
              newLiquidity,
              signers[0],
              data.borrowGivenCollateralParams
            )
            return borrowGivenCollateral
          }

          await borrowGivenCollateralProperties(data, currentTime, success, assetToken.address, collateralToken.address)
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(600000)

})

describe('Borrow Given Collateral ETH Asset', () => {
  it('Succeeded', async () => {
    const { maturity, convenience, collateralToken } = await loadFixture(fixture)
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
            const newLiquidity = await newLiquidityETHAssetFixture(constructor, signers[0], data.newLiquidityParams)
            await setTime(Number(currentTime + 10000n))
            const borrowGivenCollateral = await borrowGivenCollateralETHAssetFixture(
              newLiquidity,
              signers[0],
              data.borrowGivenCollateralParams
            )
            return borrowGivenCollateral
          }

          await borrowGivenCollateralProperties(
            data,
            currentTime,
            success,
            convenience.wethContract.address,
            collateralToken.address
          )
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(600000)
})

describe('Borrow Given Collateral ETH Collateral', () => {
  it('Succeeded', async () => {
    const { maturity, assetToken, convenience } = await loadFixture(fixture)
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
            const newLiquidity = await newLiquidityETHCollateralFixture(
              constructor,
              signers[0],
              data.newLiquidityParams
            )
            await setTime(Number(currentTime + 10000n))
            const borrowGivenCollateral = await borrowGivenCollateralETHCollateralFixture(
              newLiquidity,
              signers[0],
              data.borrowGivenCollateralParams
            )
            return borrowGivenCollateral
          }

          await borrowGivenCollateralProperties(
            data,
            currentTime,
            success,
            assetToken.address,
            convenience.wethContract.address
          )
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(600000)
})

async function borrowGivenCollateralProperties(
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
  const { yIncreaseBorrowGivenCollateral, zIncreaseBorrowGivenCollateral } =
    BorrowMath.getYandZIncreaseBorrowGivenCollateral(
      state,
      data.borrowGivenCollateralParams.assetOut,
      result.maturity,
      currentTime + 10_000n,
      data.borrowGivenCollateralParams.collateralIn
    )

  const delState = {
    x: data.borrowGivenCollateralParams.assetOut,
    y: yIncreaseBorrowGivenCollateral,
    z: zIncreaseBorrowGivenCollateral,
  }

  const debt = BorrowMath.getDebt(delState, maturity, currentTime + 10_000n)
  const collateral = BorrowMath.getCollateral(state, delState, maturity, currentTime + 10_000n)

  const natives = await result.convenience.getNatives(assetAddress, collateralAddress, maturity)
  const cdToken = CollateralizedDebt__factory.connect(natives.collateralizedDebt, ethers.provider)

  const cdTokenBalance = await cdToken.dueOf(1)
  const debtContract = cdTokenBalance.debt.toBigInt()
  const collateralContract = cdTokenBalance.collateral.toBigInt()

  expect(debtContract).equalBigInt(debt)
  expect(collateralContract).equalBigInt(collateral)
}
