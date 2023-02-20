import { ethers, waffle } from 'hardhat'
import { mulDiv, now, min, shiftRightUp, mulDivUp, advanceTimeAndBlock, setTime } from '../shared/Helper'
import { expect } from '../shared/Expect'
import * as LiquidityMath from '../libraries/LiquidityMath'
import {
  newLiquidityFixture,
  constructorFixture,
  Fixture,
  liquidityGivenDebtFixture,
  liquidityGivenDebtETHAssetFixture,
  liquidityGivenDebtETHCollateralFixture,
  newLiquidityETHAssetFixture,
  newLiquidityETHCollateralFixture,
} from '../shared/Fixtures'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import * as fc from 'fast-check'
import { AddLiquidityGivenAssetParams, NewLiquidityParams } from '../types'
import {
  CollateralizedDebt__factory,
  ERC20__factory,
  TestToken,
  TimeswapPair,
  TimeswapPair__factory,
} from '../../typechain'
import * as LiquidityFilter from '../filters/Liquidity'
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

const testCases = [
  {
    newLiquidityParams: {
      assetIn: 10000n,
      debtIn: 12000n,
      collateralIn: 1000n,
    },
    liquidityGivenDebtParams: {
      debtIn: 10000n,
      minLiquidity: 1000n,
      maxAsset: 15000n,
      maxCollateral: 2000n,
    },
  },
  {
    newLiquidityParams: {
      assetIn: 10000n,
      debtIn: 12000n,
      collateralIn: 1000n,
    },
    liquidityGivenDebtParams: {
      debtIn: 100000n,
      minLiquidity: 10000n,
      maxAsset: 150000n,
      maxCollateral: 20000n,
    },
  },
]

describe('Liquidity Given Debt', () => {
  testCases.forEach((testCase, index) => {
    it(`Succeeded ${index}`, async () => {
      const { maturity, assetToken, collateralToken } = await loadFixture(fixture)
      let currentTime = await now()

      const constructorFixture = await loadFixture(fixture)
      await setTime(Number(currentTime + 5000n))
      const newLiquidity = await newLiquidityFixture(constructorFixture, signers[0], testCase.newLiquidityParams)
      await setTime(Number(currentTime + 10000n))
      const liquidityGivenDebt = await liquidityGivenDebtFixture(
        newLiquidity,
        signers[0],
        testCase.liquidityGivenDebtParams
      )

      await liquidityGivenDebtProperties(
        testCase,
        currentTime,
        liquidityGivenDebt,
        assetToken.address,
        collateralToken.address
      )
    })
  })
})

describe('Liquidity Given Debt ETH Asset', () => {
  testCases.forEach((testCase, index) => {
    it(`Succeeded ${index}`, async () => {
      const { maturity, convenience, assetToken, collateralToken } = await loadFixture(fixture)
      let currentTime = await now()

      const constructorFixture = await loadFixture(fixture)
      await setTime(Number(currentTime + 5000n))
      const newLiquidity = await newLiquidityETHAssetFixture(
        constructorFixture,
        signers[0],
        testCase.newLiquidityParams
      )
      await setTime(Number(currentTime + 10000n))
      const liquidityGivenDebt = await liquidityGivenDebtETHAssetFixture(
        newLiquidity,
        signers[0],
        testCase.liquidityGivenDebtParams
      )

      await liquidityGivenDebtProperties(
        testCase,
        currentTime,
        liquidityGivenDebt,
        convenience.wethContract.address,
        collateralToken.address
      )
    })
  })
})

describe('Liquidity Given Debt ETH Collateral', () => {
  testCases.forEach((testCase, index) => {
    it(`Succeeded ${index}`, async () => {
      const { maturity, convenience, assetToken, collateralToken } = await loadFixture(fixture)
      let currentTime = await now()

      const constructorFixture = await loadFixture(fixture)
      await setTime(Number(currentTime + 5000n))
      const newLiquidity = await newLiquidityETHCollateralFixture(
        constructorFixture,
        signers[0],
        testCase.newLiquidityParams
      )
      await setTime(Number(currentTime + 10000n))
      const liquidityGivenDebt = await liquidityGivenDebtETHCollateralFixture(
        newLiquidity,
        signers[0],
        testCase.liquidityGivenDebtParams
      )

      await liquidityGivenDebtProperties(
        testCase,
        currentTime,
        liquidityGivenDebt,
        assetToken.address,
        convenience.wethContract.address
      )
    })
  })
})

async function liquidityGivenDebtProperties(
  data: {
    newLiquidityParams: {
      assetIn: bigint
      debtIn: bigint
      collateralIn: bigint
    }
    liquidityGivenDebtParams: {
      debtIn: bigint
      minLiquidity: bigint
      maxAsset: bigint
      maxCollateral: bigint
    }
  },
  currentTime: bigint,
  fixture: {
    convenience: Convenience
    assetToken: TestToken
    collateralToken: TestToken
    maturity: bigint
  },
  assetAddress: string,
  collateralAddress: string
) {
  const result = fixture

  const maybeNewMintParams = LiquidityMath.getNewLiquidityParams(
    data.newLiquidityParams.assetIn,
    data.newLiquidityParams.debtIn,
    data.newLiquidityParams.collateralIn,
    currentTime + 5_000n,
    maturity
  )
  let { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = { yIncreaseNewLiquidity: 0n, zIncreaseNewLiquidity: 0n }
  if (maybeNewMintParams != false) {
    yIncreaseNewLiquidity = maybeNewMintParams.yIncreaseNewLiquidity
    zIncreaseNewLiquidity = maybeNewMintParams.zIncreaseNewLiquidity
  }

  const state = {
    x: data.newLiquidityParams.assetIn,
    y: yIncreaseNewLiquidity,
    z: zIncreaseNewLiquidity,
  }
  const { xIncreaseAddLiquidity, yIncreaseAddLiquidity, zIncreaseAddLiquidity } =
    LiquidityMath.getIncreaseAddLiquidityGivenDebtParams(
      state,
      data.liquidityGivenDebtParams.debtIn,
      maturity,
      currentTime
    )
  const delState = {
    x: xIncreaseAddLiquidity,
    y: yIncreaseAddLiquidity,
    z: zIncreaseAddLiquidity,
  }
  const liquidityBalanceNew = LiquidityMath.getInitialLiquidity(data.newLiquidityParams.assetIn)

  const maybeLiquidityBalanceAdd = LiquidityMath.getLiquidity(state, delState, currentTime + 10_000n, maturity)
  let liquidityBalanceAdd = 0n
  if (typeof maybeLiquidityBalanceAdd != 'string') {
    liquidityBalanceAdd = maybeLiquidityBalanceAdd
  }
  const liquidityBalance = liquidityBalanceNew + liquidityBalanceAdd

  const debt = LiquidityMath.getDebtAddLiquidity(
    { x: xIncreaseAddLiquidity, y: yIncreaseAddLiquidity, z: zIncreaseAddLiquidity },
    maturity,
    currentTime + 10_000n
  )
  const collateral = LiquidityMath.getCollateralAddLiquidity(
    { x: xIncreaseAddLiquidity, y: yIncreaseAddLiquidity, z: zIncreaseAddLiquidity },
    maturity,
    currentTime + 10_000n
  )

  const natives = await result.convenience.getNatives(assetAddress, collateralAddress, maturity)

  // const liquidityToken = ERC20__factory.connect(natives.liquidity, ethers.provider)
  // const liquidityBalanceContract = (await liquidityToken.balanceOf(signers[0].address)).toBigInt()
  // expect(liquidityBalanceContract).equalBigInt(liquidityBalance)

  const collateralizedDebtContract = CollateralizedDebt__factory.connect(natives.collateralizedDebt, ethers.provider)
  const collateralizedDebtToken = await collateralizedDebtContract.dueOf(1)

  const collateralBalanceContract = collateralizedDebtToken.collateral.toBigInt()
  const debtBalanceContract = collateralizedDebtToken.debt.toBigInt()

  expect(collateralBalanceContract).equalBigInt(collateral)
  expect(debtBalanceContract).equalBigInt(debt)
}
