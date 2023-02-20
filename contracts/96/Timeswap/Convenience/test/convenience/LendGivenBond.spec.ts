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
  lendGivenBondETHCollateralFixture,
  newLiquidityETHCollateralFixture,
  lendGivenBondETHAssetFixture,
  newLiquidityETHAssetFixture,
} from '../shared/Fixtures'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import * as fc from 'fast-check'
import { LendGivenBondParams, NewLiquidityParams } from '../types'
import {
  BondInterest__factory,
  BondPrincipal__factory,
  ERC20__factory,
  InsuranceInterest__factory,
  InsurancePrincipal__factory,
  TestToken,
} from '../../typechain'
import * as LiquidityFilter from '../filters/Liquidity'
import * as LendFilter from '../filters/Lend'
import { Convenience } from '../shared/Convenience'
import { FEE, PROTOCOL_FEE } from '../shared/Constants'

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
    lendGivenBondParams: {
      assetIn: 1000n,
      bondOut: 1010n,
      minInsurance: 50n,
    },
  },
  {
    newLiquidityParams: {
      assetIn: 10000n,
      debtIn: 12000n,
      collateralIn: 1000n,
    },
    lendGivenBondParams: {
      assetIn: 1000n,
      bondOut: 1087n,
      minInsurance: 50n,
    },
  },
  {
    newLiquidityParams: {
      assetIn: 10000n,
      debtIn: 12000n,
      collateralIn: 1000n,
    },
    lendGivenBondParams: {
      assetIn: 500n,
      bondOut: 591n,
      minInsurance: 20n,
    },
  },
  // {
  //   newLiquidityParams: {
  //     assetIn: 10000n,
  //     debtIn: 12000n,
  //     collateralIn: 1000n,
  //   },
  //   lendGivenBondParams: {
  //     assetIn: 1000000000n,
  //     bondOut: 995719504n,
  //     minInsurance: 50n,
  //   },
  // },
  {
    newLiquidityParams: {
      assetIn: 10000n,
      debtIn: 12000n,
      collateralIn: 990n,
    },
    lendGivenBondParams: {
      assetIn: 1000n,
      bondOut: 1010n,
      minInsurance: 50n,
    },
  },
  {
    newLiquidityParams: {
      assetIn: 10000n,
      debtIn: 12000n,
      collateralIn: 990n,
    },
    lendGivenBondParams: {
      assetIn: 100n,
      bondOut: 110n,
      minInsurance: 2n,
    },
  },
]

describe('Lend Given Bond', () => {
  testCases.forEach((testCase, index) => {
    it(`Succeeded ${index}`, async () => {
      const { maturity, assetToken, collateralToken } = await loadFixture(fixture)
      let currentTime = await now()

      const constructorFixture = await loadFixture(fixture)
      await setTime(Number(currentTime + 5000n))
      const newLiquidity = await newLiquidityFixture(constructorFixture, signers[0], testCase.newLiquidityParams)
      await setTime(Number(currentTime + 10000n))
      const lendGivenBond = await lendGivenBondFixture(newLiquidity, signers[0], testCase.lendGivenBondParams)

      await lendGivenBondProperties(testCase, currentTime, lendGivenBond, assetToken.address, collateralToken.address)
    })
  })
})
describe('Lend Given Bond ETH Asset', () => {
  testCases.forEach((testCase, index) => {
    it(`Succeeded ${index}`, async () => {
      const { maturity, convenience, collateralToken } = await loadFixture(fixture)
      let currentTime = await now()

      const constructorFixture = await loadFixture(fixture)
      await setTime(Number(currentTime + 5000n))
      const newLiquidity = await newLiquidityETHAssetFixture(constructorFixture, signers[0], testCase.newLiquidityParams)
      await setTime(Number(currentTime + 10000n))
      const lendGivenBond = await lendGivenBondETHAssetFixture(newLiquidity, signers[0], testCase.lendGivenBondParams)

      await lendGivenBondProperties(testCase, currentTime, lendGivenBond, convenience.wethContract.address, collateralToken.address)
    })
  })
})
describe('Lend Given Bond Collateral', () => {
  testCases.forEach((testCase, index) => {
    it(`Succeeded ${index}`, async () => {
      const { maturity, assetToken, convenience } = await loadFixture(fixture)
      let currentTime = await now()

      const constructorFixture = await loadFixture(fixture)
      await setTime(Number(currentTime + 5000n))
      const newLiquidity = await newLiquidityETHCollateralFixture(constructorFixture, signers[0], testCase.newLiquidityParams)
      await setTime(Number(currentTime + 10000n))
      const lendGivenBond = await lendGivenBondETHCollateralFixture(newLiquidity, signers[0], testCase.lendGivenBondParams)

      await lendGivenBondProperties(testCase, currentTime, lendGivenBond, assetToken.address, convenience.wethContract.address)
    })
  })
})
// describe('Lend Given Bond', () => {
//   it('Succeeded', async () => {
//     const { maturity, assetToken, collateralToken } = await loadFixture(fixture)
//     let currentTime = await now()

//     await fc.assert(
//       fc.asyncProperty(
//         fc
//           .record({
//             newLiquidityParams: fc
//               .record({
//                 assetIn: fc.bigUintN(112),
//                 debtIn: fc.bigUintN(112),
//                 collateralIn: fc.bigUintN(112),
//               })
//               .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)),
//             lendGivenBondParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               bondOut: fc.bigUintN(112),
//               minInsurance: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => LendFilter.lendGivenBondSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
//         async (data) => {
//           const success = async () => {
//             const constructor = await loadFixture(fixture)
//             await setTime(Number(currentTime + 5000n))
//             const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
//             await setTime(Number(currentTime + 10000n))
//             const lendGivenBond = await lendGivenBondFixture(newLiquidity, signers[0], data.lendGivenBondParams)
//             return lendGivenBond
//           }

//           await lendGivenBondProperties(data, currentTime, success, assetToken.address, collateralToken.address)
//         }
//       ),
//       { skipAllAfterTimeLimit: 50000, numRuns: 10 }
//     )
//   }).timeout(100000)

//   it('Failed', async () => {
//     const { maturity, assetToken, collateralToken } = await loadFixture(fixture)
//     let currentTime = await now()

//     await fc.assert(
//       fc.asyncProperty(
//         fc
//           .record({
//             newLiquidityParams: fc
//               .record({
//                 assetIn: fc.bigUintN(112),
//                 debtIn: fc.bigUintN(112),
//                 collateralIn: fc.bigUintN(112),
//               })
//               .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)),
//             lendGivenBondParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               bondOut: fc.bigUintN(112),
//               minInsurance: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => !LendFilter.lendGivenBondSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
//           .map((x) => LendFilter.lendGivenBondError(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
//         async ({ data, error }) => {
//           const constructor = await loadFixture(fixture)
//           await setTime(Number(currentTime + 5000n))
//           await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
//           await setTime(Number(currentTime + 10000n))

//           await expect(
//             constructor.convenience.convenienceContract.lendGivenBond({
//               asset: assetToken.address,
//               collateral: collateralToken.address,
//               maturity,
//               bondTo: signers[0].address,
//               insuranceTo: signers[0].address,
//               assetIn: data.lendGivenBondParams.assetIn,
//               bondOut: data.lendGivenBondParams.bondOut,
//               minInsurance: data.lendGivenBondParams.minInsurance,
//               deadline: maturity,
//             })
//           ).to.be.revertedWith(error)
//         }
//       ),
//       { skipAllAfterTimeLimit: 50000, numRuns: 10 }
//     )
//   }).timeout(100000)
// })

// describe('Lend Given Bond ETH Asset', () => {
//   it('Succeeded', async () => {
//     const { maturity, convenience, collateralToken } = await loadFixture(fixture)
//     let currentTime = await now()

//     await fc.assert(
//       fc.asyncProperty(
//         fc
//           .record({
//             newLiquidityParams: fc
//               .record({
//                 assetIn: fc.bigUintN(112),
//                 debtIn: fc.bigUintN(112),
//                 collateralIn: fc.bigUintN(112),
//               })
//               .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)),
//             lendGivenBondParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               bondOut: fc.bigUintN(112),
//               minInsurance: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => LendFilter.lendGivenBondSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
//         async (data) => {
//           const success = async () => {
//             const constructor = await loadFixture(fixture)
//             await setTime(Number(currentTime + 5000n))
//             const newLiquidity = await newLiquidityETHAssetFixture(constructor, signers[0], data.newLiquidityParams)
//             await setTime(Number(currentTime + 10000n))
//             const lendGivenBond = await lendGivenBondETHAssetFixture(newLiquidity, signers[0], data.lendGivenBondParams)
//             return lendGivenBond
//           }

//           await lendGivenBondProperties(
//             data,
//             currentTime,
//             success,
//             convenience.wethContract.address,
//             collateralToken.address
//           )
//         }
//       ),
//       { skipAllAfterTimeLimit: 50000, numRuns: 10 }
//     )
//   }).timeout(100000)

//   it('Failed', async () => {
//     const { maturity, collateralToken } = await loadFixture(fixture)
//     let currentTime = await now()

//     await fc.assert(
//       fc.asyncProperty(
//         fc
//           .record({
//             newLiquidityParams: fc
//               .record({
//                 assetIn: fc.bigUintN(112),
//                 debtIn: fc.bigUintN(112),
//                 collateralIn: fc.bigUintN(112),
//               })
//               .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)),
//             lendGivenBondParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               bondOut: fc.bigUintN(112),
//               minInsurance: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => !LendFilter.lendGivenBondSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
//           .map((x) => LendFilter.lendGivenBondError(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
//         async ({ data, error }) => {
//           const constructor = await loadFixture(fixture)
//           await setTime(Number(currentTime + 5000n))
//           await newLiquidityETHAssetFixture(constructor, signers[0], data.newLiquidityParams)
//           await setTime(Number(currentTime + 10000n))

//           await expect(
//             constructor.convenience.convenienceContract.lendGivenBondETHAsset(
//               {
//                 collateral: collateralToken.address,
//                 maturity,
//                 bondTo: signers[0].address,
//                 insuranceTo: signers[0].address,
//                 bondOut: data.lendGivenBondParams.bondOut,
//                 minInsurance: data.lendGivenBondParams.minInsurance,
//                 deadline: maturity,
//               },
//               { value: data.lendGivenBondParams.assetIn }
//             )
//           ).to.be.revertedWith(error)
//         }
//       ),
//       { skipAllAfterTimeLimit: 50000, numRuns: 10 }
//     )
//   }).timeout(100000)
// })

// describe('Lend Given Bond ETH Collateral', () => {
//   it('Succeeded', async () => {
//     const { maturity, assetToken, convenience } = await loadFixture(fixture)
//     let currentTime = await now()

//     await fc.assert(
//       fc.asyncProperty(
//         fc
//           .record({
//             newLiquidityParams: fc
//               .record({
//                 assetIn: fc.bigUintN(112),
//                 debtIn: fc.bigUintN(112),
//                 collateralIn: fc.bigUintN(112),
//               })
//               .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)),
//             lendGivenBondParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               bondOut: fc.bigUintN(112),
//               minInsurance: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => LendFilter.lendGivenBondSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
//         async (data) => {
//           const success = async () => {
//             const constructor = await loadFixture(fixture)
//             await setTime(Number(currentTime + 5000n))
//             const newLiquidity = await newLiquidityETHCollateralFixture(
//               constructor,
//               signers[0],
//               data.newLiquidityParams
//             )
//             await setTime(Number(currentTime + 10000n))
//             const lendGivenBond = await lendGivenBondETHCollateralFixture(
//               newLiquidity,
//               signers[0],
//               data.lendGivenBondParams
//             )
//             return lendGivenBond
//           }

//           await lendGivenBondProperties(
//             data,
//             currentTime,
//             success,
//             assetToken.address,
//             convenience.wethContract.address
//           )
//         }
//       ),
//       { skipAllAfterTimeLimit: 50000, numRuns: 10 }
//     )
//   }).timeout(100000)

//   it('Failed', async () => {
//     const { maturity, assetToken } = await loadFixture(fixture)
//     let currentTime = await now()

//     await fc.assert(
//       fc.asyncProperty(
//         fc
//           .record({
//             newLiquidityParams: fc
//               .record({
//                 assetIn: fc.bigUintN(112),
//                 debtIn: fc.bigUintN(112),
//                 collateralIn: fc.bigUintN(112),
//               })
//               .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)),
//             lendGivenBondParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               bondOut: fc.bigUintN(112),
//               minInsurance: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => !LendFilter.lendGivenBondSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
//           .map((x) => LendFilter.lendGivenBondError(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
//         async ({ data, error }) => {
//           const constructor = await loadFixture(fixture)
//           await setTime(Number(currentTime + 5000n))
//           await newLiquidityETHCollateralFixture(constructor, signers[0], data.newLiquidityParams)
//           await setTime(Number(currentTime + 10000n))

//           await expect(
//             constructor.convenience.convenienceContract.lendGivenBondETHCollateral({
//               asset: assetToken.address,
//               maturity,
//               bondTo: signers[0].address,
//               insuranceTo: signers[0].address,
//               assetIn: data.lendGivenBondParams.assetIn,
//               bondOut: data.lendGivenBondParams.bondOut,
//               minInsurance: data.lendGivenBondParams.minInsurance,
//               deadline: maturity,
//             })
//           ).to.be.revertedWith(error)
//         }
//       ),
//       { skipAllAfterTimeLimit: 50000, numRuns: 10 }
//     )
//   }).timeout(100000)
// })

async function lendGivenBondProperties(
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
  fixture: {
    convenience: Convenience
    assetToken: TestToken
    collateralToken: TestToken
    maturity: bigint
  },
  assetAddress: string,
  collateralAddress: string
) {
  const neededTime = (await now()) + 100n

  // const result = await loadFixture(success)
  const result = fixture

  let [yIncreaseNewLiquidity, zIncreaseNewLiquidity] = [0n, 0n]
  const maybeNewLiq = LiquidityMath.getNewLiquidityParams(
    data.newLiquidityParams.assetIn,
    data.newLiquidityParams.debtIn,
    data.newLiquidityParams.collateralIn,
    currentTime + 5_000n,
    maturity
  )
  if (maybeNewLiq !== false) {
    yIncreaseNewLiquidity = maybeNewLiq.yIncreaseNewLiquidity
    zIncreaseNewLiquidity = maybeNewLiq.zIncreaseNewLiquidity
  }

  const state = {
    x: data.newLiquidityParams.assetIn,
    y: yIncreaseNewLiquidity,
    z: zIncreaseNewLiquidity,
  }
  const { yDecrease: yDecreaseLendGivenBond, zDecrease: zDecreaseLendGivenBond } = LendMath.getLendGivenBondParams(
    state,
    FEE,
    PROTOCOL_FEE,
    maturity,
    currentTime + 10_000n,
    data.lendGivenBondParams.assetIn,
    data.lendGivenBondParams.bondOut
  )
  const delState = { x: data.lendGivenBondParams.assetIn, y: yDecreaseLendGivenBond, z: zDecreaseLendGivenBond }
  const bond = LendMath.getBond(delState, maturity, currentTime + 10_000n)
  const natives = await result.convenience.getNatives(assetAddress, collateralAddress, maturity)

  const bondPrincipalToken = ERC20__factory.connect(natives.bondPrincipal, ethers.provider)
  const bondInterestToken = ERC20__factory.connect(natives.bondInterest, ethers.provider)
  const insurancePrincipalToken = ERC20__factory.connect(natives.insurancePrincipal, ethers.provider)
  const insuranceInterestToken = ERC20__factory.connect(natives.insuranceInterest, ethers.provider)

  const assetToken = ERC20__factory.connect(assetAddress, ethers.provider)
  const collateralToken = ERC20__factory.connect(collateralAddress, ethers.provider)
  //   const insuranceTokenName = await insuranceToken.name()
  //   const insuranceTokenSymbol = await insuranceToken.symbol()
  //   const insuranceTokenDecimals  = await insuranceToken.decimals()
  //   const bondTokenName = await bondToken.name()
  //   const bondTokenSymbol = await bondToken.symbol()
  //   const bondTokenDecimals = await bondToken.decimals()

  //   const assetTokenSymbol = await assetToken.symbol()
  //   const assetTokenName = await assetToken.name()
  //   const collateralTokenSymbol = await collateralToken.symbol()
  //   const collateralTokenName = await collateralToken.name()

  //   expect(insuranceTokenSymbol).equals(`TS-INS-${assetTokenSymbol}-${collateralTokenSymbol}-${maturity}`)
  //   expect(insuranceTokenName).equals(`Timeswap Insurance - ${assetTokenName} - ${collateralTokenName} - ${maturity}`)
  //   expect(insuranceTokenDecimals).equals(18)

  //   expect(bondTokenSymbol).equals(`TS-BND-${assetTokenSymbol}-${collateralTokenSymbol}-${maturity}`)
  //   expect(bondTokenName).equals(`Timeswap Bond - ${assetTokenName} - ${collateralTokenName} - ${maturity}`)
  //   expect(bondTokenDecimals).equals(18)

  expect(bond).gteBigInt(data.lendGivenBondParams.bondOut)
}
