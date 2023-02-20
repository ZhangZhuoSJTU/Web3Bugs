import { ethers, waffle } from 'hardhat'
import { mulDivUp, now, setTime, shiftRightUp } from '../shared/Helper'
import { expect } from '../shared/Expect'
import {
  newLiquidityFixture,
  constructorFixture,
  Fixture,
  newLiquidityETHCollateralFixture,
  newLiquidityETHAssetFixture,
} from '../shared/Fixtures'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import * as fc from 'fast-check'
import { NewLiquidityParams } from '../types'
import { ERC20__factory, CollateralizedDebt__factory, TestToken } from '../../typechain'
import * as LiquidityFilter from '../filters/Liquidity'
import * as LiquidityMath from '../libraries/LiquidityMath'
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

describe('New Liquidity', () => {
  it('Succeeded', async () => {
    const { maturity, assetToken, collateralToken } = await loadFixture(fixture)
    let currentTime = await now()

    await fc.assert(
      fc.asyncProperty(
        fc
          .record({ assetIn: fc.bigUintN(112), debtIn: fc.bigUintN(112), collateralIn: fc.bigUintN(112) })
          .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)).noShrink(),
        async (data) => {
          const success = async () => {
            const constructor = await loadFixture(fixture)
            await setTime(Number(currentTime + 5000n))
            const newLiquidity = await newLiquidityFixture(constructor, signers[0], data)
            return newLiquidity
          }

          await newLiquidityProperties(data, currentTime, success, assetToken.address, collateralToken.address)
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
          .record({ assetIn: fc.bigUintN(112), debtIn: fc.bigUintN(112), collateralIn: fc.bigUintN(112) })
          .filter((x) => !LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity))
          .map((x) => LiquidityFilter.newLiquidityError(x, currentTime + 5_000n, maturity)),
        async ({ data, error }) => {
          const constructor = await loadFixture(fixture)
          await setTime(Number(currentTime + 5000n))
          await expect(
            constructor.convenience.convenienceContract.newLiquidity({
              asset: assetToken.address,
              collateral: collateralToken.address,
              maturity,
              liquidityTo: signers[0].address,
              dueTo: signers[0].address,
              assetIn: data.assetIn,
              debtIn: data.debtIn,
              collateralIn: data.collateralIn,
              deadline: maturity,
            })
          ).to.be.revertedWith(error)
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(600000)
})

describe('New Liquidity ETH Asset', () => {
  it('Succeeded', async () => {
    const { maturity, convenience, collateralToken } = await loadFixture(fixture)
    let currentTime = await now()

    await fc.assert(
      fc.asyncProperty(
        fc
          .record({ assetIn: fc.bigUintN(112), debtIn: fc.bigUintN(112), collateralIn: fc.bigUintN(112) })
          .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)).noShrink(),
        async (data) => {
          const success = async () => {
            const constructor = await loadFixture(fixture)
            await setTime(Number(currentTime + 5000n))
            const newLiquidity = await newLiquidityETHAssetFixture(constructor, signers[0], data)
            return newLiquidity
          }

          await newLiquidityProperties(
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
          .record({ assetIn: fc.bigUintN(112), debtIn: fc.bigUintN(112), collateralIn: fc.bigUintN(112) })
          .filter((x) => !LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity))
          .map((x) => LiquidityFilter.newLiquidityError(x, currentTime + 5_000n, maturity)),
        async ({ data, error }) => {
          const constructor = await loadFixture(fixture)
          await setTime(Number(currentTime + 5000n))
          await expect(
            constructor.convenience.convenienceContract.newLiquidityETHAsset(
              {
                collateral: collateralToken.address,
                maturity,
                liquidityTo: signers[0].address,
                dueTo: signers[0].address,
                debtIn: data.debtIn,
                collateralIn: data.collateralIn,
                deadline: maturity,
              },
              { value: data.assetIn }
            )
          ).to.be.revertedWith(error)
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(600000)
})

describe('New Liquidity ETH Collateral', () => {
  it('Succeeded', async () => {
    const { maturity, assetToken, convenience } = await loadFixture(fixture)
    let currentTime = await now()

    await fc.assert(
      fc.asyncProperty(
        fc
          .record({ assetIn: fc.bigUintN(112), debtIn: fc.bigUintN(112), collateralIn: fc.bigUintN(112) })
          .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)).noShrink(),
        async (data) => {
          const success = async () => {
            const constructor = await loadFixture(fixture)
            await setTime(Number(currentTime + 5000n))
            const newLiquidity = await newLiquidityETHCollateralFixture(constructor, signers[0], data)
            return newLiquidity
          }

          await newLiquidityProperties(data, currentTime, success, assetToken.address, convenience.wethContract.address)
        }
      )
    ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
  }).timeout(600000)

  it('Failed', async () => {
    const { maturity, assetToken } = await loadFixture(fixture)
    let currentTime = await now()

    await fc.assert(
      fc.asyncProperty(
        fc
          .record({ assetIn: fc.bigUintN(112), debtIn: fc.bigUintN(112), collateralIn: fc.bigUintN(112) })
          .filter((x) => !LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity))
          .map((x) => LiquidityFilter.newLiquidityError(x, currentTime + 5_000n, maturity)).noShrink(),
        async ({ data, error }) => {
          const constructor = await loadFixture(fixture)
          await setTime(Number(currentTime + 5000n))
          await expect(
            constructor.convenience.convenienceContract.newLiquidityETHCollateral(
              {
                asset: assetToken.address,
                maturity,
                liquidityTo: signers[0].address,
                dueTo: signers[0].address,
                assetIn: data.assetIn,
                debtIn: data.debtIn,
                deadline: maturity,
              },
              { value: data.collateralIn }
            )
          ).to.be.revertedWith(error)
        }
      ),
      { skipAllAfterTimeLimit: 50000, numRuns: 10 }
    )
  }).timeout(600000)
})

async function newLiquidityProperties(
  data: {
    assetIn: bigint
    debtIn: bigint
    collateralIn: bigint
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
  const newCurrentTime = currentTime + 5_000n
  const maybeParams = LiquidityMath.getNewLiquidityParams(
    data.assetIn,
    data.debtIn,
    data.collateralIn,
    newCurrentTime,
    maturity
  )
  if(maybeParams!=false){
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = maybeParams
  const state = {
    x: data.assetIn,
    y: yIncreaseNewLiquidity,
    z: zIncreaseNewLiquidity,
  }
  const liquidityBalance = LiquidityMath.getInitialLiquidity(state.x)

  const debt = LiquidityMath.getDebtAddLiquidity(
    { x: data.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity },
    maturity,
    newCurrentTime
  )
  const collateral = LiquidityMath.getCollateralAddLiquidity(
    { x: data.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity },
    maturity,
    newCurrentTime
  )


  

  
  
  
  
  const natives = await result.convenience.getNatives(assetAddress, collateralAddress, maturity)

  const liquidityToken = ERC20__factory.connect(natives.liquidity, ethers.provider)
  const liquidityBalanceContract = (await liquidityToken.balanceOf(signers[0].address)).toBigInt()
  
  const assetToken = ERC20__factory.connect(assetAddress,ethers.provider)
  const collateralToken = ERC20__factory.connect(collateralAddress,ethers.provider)
  const liquidityTokenName = await liquidityToken.name()
  const liquidityTokenSymbol = await liquidityToken.symbol()
  const liquidityTokenDecimals  = await liquidityToken.decimals()

  const assetTokenSymbol = await assetToken.symbol()
  const assetTokenName = await assetToken.name()
  const collateralTokenSymbol = await collateralToken.symbol()
  const collateralTokenName = await collateralToken.name()
  expect(liquidityTokenSymbol).equals(`TS-LIQ-${assetTokenSymbol}-${collateralTokenSymbol}-${maturity}`)
  expect(liquidityTokenName).equals(`Timeswap Liquidity - ${assetTokenName} - ${collateralTokenName} - ${maturity}`)
  expect(liquidityTokenDecimals).equals(18)
  expect(liquidityBalanceContract).equalBigInt(liquidityBalance)

  const collateralizedDebtContract = CollateralizedDebt__factory.connect(natives.collateralizedDebt, ethers.provider)
  const collateralizedDebtToken = await collateralizedDebtContract.dueOf(0)

  const collateralizedDebtName = await collateralizedDebtContract.name()
  const collateralizedDebtSymbol = await collateralizedDebtContract.symbol()
  const collateralizedDebtCollateralDecimals = await collateralizedDebtContract.collateralDecimals()
  const collateralizedDebtAssetDecimals = await collateralizedDebtContract.assetDecimals()

  expect(collateralizedDebtName).equals(`Timeswap Collateralized Debt - ${assetTokenName} - ${collateralTokenName} - ${maturity}`)
  expect(collateralizedDebtSymbol).equals(`TS-CDT-${assetTokenSymbol}-${collateralTokenSymbol}-${maturity}`)
  expect(collateralizedDebtAssetDecimals).equals(18)
  expect(collateralizedDebtCollateralDecimals).equals(18)
  const collateralBalanceContract = collateralizedDebtToken.collateral.toBigInt()
  const debtBalanceContract = collateralizedDebtToken.debt.toBigInt()

  expect(collateralBalanceContract).equalBigInt(collateral)
  expect(debtBalanceContract).equalBigInt(debt)
  }
}
