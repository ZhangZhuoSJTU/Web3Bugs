import { ethers, waffle } from 'hardhat'
import { mulDiv, now, min, shiftRightUp, mulDivUp, advanceTimeAndBlock, setTime, advanceTime } from '../shared/Helper'
import { expect } from '../shared/Expect'
import * as LiquidityMath from '../libraries/LiquidityMath'
import {
  newLiquidityFixture,
  constructorFixture,
  Fixture,
  liquidityGivenAssetFixture,
  removeLiquidityFixture,
  newLiquidityETHAssetFixture,
  removeLiquidityETHAssetFixture,
  newLiquidityETHCollateralFixture,
  removeLiquidityETHCollateralFixture,
} from '../shared/Fixtures'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import * as fc from 'fast-check'
import { AddLiquidityGivenAssetParams, NewLiquidityParams } from '../types'
import { CollateralizedDebt__factory, ERC20__factory, TestToken } from '../../typechain'
import { TimeswapPair__factory } from '../../typechain'
import * as LiquidityFilter from '../filters/Liquidity'
import { Convenience } from '../shared/Convenience'

const { loadFixture } = waffle

let maturity = 0n
let signers: SignerWithAddress[] = []

const MAXUINT112: bigint = 2n ** 112n
async function fixture(): Promise<Fixture> {
  maturity = (await now()) + 31536000n
  signers = await ethers.getSigners()

  const constructor = await constructorFixture(1n << 112n, 1n << 112n, maturity, signers[0])

  return constructor
}

describe('Remove Liquidity', () => {
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
              .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5000n, maturity)),
            removeLiquidityParams: fc.record({
              liquidityIn: fc.bigUintN(50),
            }),
          })
          .filter((x) => LiquidityFilter.removeLiquiditySuccess(x, currentTime + 5000n, maturity)).noShrink(),
        async (data) => {
          const success = async () => {
            const constructor = await loadFixture(fixture)
            await setTime(Number(currentTime + 5000n))
            const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
            await advanceTime(Number(maturity))
            const removeLiquidity = await removeLiquidityFixture(newLiquidity, signers[0], data.removeLiquidityParams)
            return removeLiquidity
          }

          await removeLiquidityProperties(data, currentTime, success, assetToken.address, collateralToken.address)
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(600000)

  it('Failed', async () => {
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
              .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5000n, maturity)),
            removeLiquidityParams: fc.record({
              liquidityIn: fc.bigUintN(50),
            }),
          })
          .filter((x) => !LiquidityFilter.removeLiquiditySuccess(x, currentTime + 5000n, maturity))
          .map((x) => LiquidityFilter.removeLiquidityError(x, currentTime + 5000n, maturity)),
        async ({ data, error }) => {
          const constructor = await loadFixture(fixture)
          await setTime(Number(currentTime + 5000n))
          await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
          await advanceTime(Number(maturity))

          await expect(
            constructor.convenience.convenienceContract.removeLiquidity({
              asset: assetToken.address,
              collateral: collateralToken.address,
              maturity,
              assetTo: signers[0].address,
              collateralTo: signers[0].address,
              liquidityIn: data.removeLiquidityParams.liquidityIn,
            })
          ).to.be.revertedWith(error)
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(600000)
})

describe('Remove Liquidity ETH Asset', () => {
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
              .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5000n, maturity)),
            removeLiquidityParams: fc.record({
              liquidityIn: fc.bigUintN(50),
            }),
          })
          .filter((x) => LiquidityFilter.removeLiquiditySuccess(x, currentTime + 5000n, maturity)).noShrink(),
        async (data) => {
          const success = async () => {
            const constructor = await loadFixture(fixture)
            await setTime(Number(currentTime + 5000n))
            const newLiquidity = await newLiquidityETHAssetFixture(constructor, signers[0], data.newLiquidityParams)
            await advanceTime(Number(maturity))
            const removeLiquidity = await removeLiquidityETHAssetFixture(
              newLiquidity,
              signers[0],
              data.removeLiquidityParams
            )
            return removeLiquidity
          }

          await removeLiquidityProperties(
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

  it('Failed', async () => {
    const { maturity, collateralToken } = await loadFixture(fixture)
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
              .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5000n, maturity)),
            removeLiquidityParams: fc.record({
              liquidityIn: fc.bigUintN(50),
            }),
          })
          .filter((x) => !LiquidityFilter.removeLiquiditySuccess(x, currentTime + 5000n, maturity))
          .map((x) => LiquidityFilter.removeLiquidityError(x, currentTime + 5000n, maturity)),
        async ({ data, error }) => {
          const constructor = await loadFixture(fixture)
          await setTime(Number(currentTime + 5000n))
          await newLiquidityETHAssetFixture(constructor, signers[0], data.newLiquidityParams)
          await advanceTime(Number(maturity))

          await expect(
            constructor.convenience.convenienceContract.removeLiquidityETHAsset({
              collateral: collateralToken.address,
              maturity,
              assetTo: signers[0].address,
              collateralTo: signers[0].address,
              liquidityIn: data.removeLiquidityParams.liquidityIn,
            })
          ).to.be.revertedWith(error)
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(600000)
})

describe('Remove Liquidity ETH Collateral', () => {
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
              .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5000n, maturity)).noShrink(),
            removeLiquidityParams: fc.record({
              liquidityIn: fc.bigUintN(112),
            }),
          })
          .filter((x) => LiquidityFilter.removeLiquiditySuccess(x, currentTime + 5000n, maturity)),
        async (data) => {
          const success = async () => {
            const constructor = await loadFixture(fixture)
            await setTime(Number(currentTime + 5000n))
            const newLiquidity = await newLiquidityETHCollateralFixture(
              constructor,
              signers[0],
              data.newLiquidityParams
            )
            await advanceTime(Number(maturity))
            const removeLiquidity = await removeLiquidityETHCollateralFixture(
              newLiquidity,
              signers[0],
              data.removeLiquidityParams
            )
            return removeLiquidity
          }

          await removeLiquidityProperties(
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

  it('Failed', async () => {
    const { maturity, assetToken } = await loadFixture(fixture)
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
              .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5000n, maturity)),
            removeLiquidityParams: fc.record({
              liquidityIn: fc.bigUintN(50),
            }),
          })
          .filter((x) => !LiquidityFilter.removeLiquiditySuccess(x, currentTime + 5000n, maturity))
          .map((x) => LiquidityFilter.removeLiquidityError(x, currentTime + 5000n, maturity)),
        async ({ data, error }) => {
          const constructor = await loadFixture(fixture)
          await setTime(Number(currentTime + 5000n))
          await newLiquidityETHCollateralFixture(constructor, signers[0], data.newLiquidityParams)
          await advanceTime(Number(maturity))

          await expect(
            constructor.convenience.convenienceContract.removeLiquidityETHCollateral({
              asset: assetToken.address,
              maturity,
              assetTo: signers[0].address,
              collateralTo: signers[0].address,
              liquidityIn: data.removeLiquidityParams.liquidityIn,
            })
          ).to.be.revertedWith(error)
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(600000)
})

async function removeLiquidityProperties(
  data: {
    newLiquidityParams: {
      assetIn: bigint
      debtIn: bigint
      collateralIn: bigint
    }
    removeLiquidityParams: {
      liquidityIn: bigint
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
  const result = await loadFixture(success)
  
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    data.newLiquidityParams.assetIn,
    data.newLiquidityParams.debtIn,
    data.newLiquidityParams.collateralIn,
    currentTime + 5000n,
    maturity
  )
  const state = {
    x: data.newLiquidityParams.assetIn,
    y: yIncreaseNewLiquidity,
    z: zIncreaseNewLiquidity,
  }
  const liquidityBalanceNew = LiquidityMath.liquidityCalculateNewLiquidity(
    state,
    currentTime + 5000n,
    maturity
  )
  const liquidityBalance = liquidityBalanceNew - data.removeLiquidityParams.liquidityIn
  const natives = await result.convenience.getNatives(assetAddress, collateralAddress, maturity)

  const liquidityToken = ERC20__factory.connect(natives.liquidity, ethers.provider)
  const liquidityBalanceContract = (await liquidityToken.balanceOf(signers[0].address)).toBigInt()
  expect(liquidityBalanceContract).equalBigInt(liquidityBalance)

  const totalLiquidityBalanceContract = await TimeswapPair__factory.connect(
    await result.convenience.factoryContract.getPair(assetAddress, collateralAddress),
    ethers.provider
  ).totalLiquidity(maturity)
  const totalLiquidityBalance = (state.x <<16n)- data.removeLiquidityParams.liquidityIn
  expect(totalLiquidityBalanceContract).equalBigInt(totalLiquidityBalance)
}
