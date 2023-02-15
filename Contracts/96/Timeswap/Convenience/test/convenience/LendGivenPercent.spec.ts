import { ethers, waffle } from 'hardhat'
import { mulDiv, now, min, shiftRightUp, mulDivUp, advanceTimeAndBlock, setTime } from '../shared/Helper'
import { expect } from '../shared/Expect'
import * as LiquidityMath from '../libraries/LiquidityMath'
import * as LendMath from '../libraries/LendMath'
import {
  newLiquidityFixture,
  constructorFixture,
  Fixture,
  lendGivenPercentFixture,
  lendGivenPercentETHAssetFixture,
  lendGivenPercentETHCollateralFixture,
  newLiquidityETHAssetFixture,
  newLiquidityETHCollateralFixture,
} from '../shared/Fixtures'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import * as fc from 'fast-check'
import { LendGivenPercentParams, NewLiquidityParams } from '../types'
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
    lendGivenPercentParams: {
      assetIn: 1000n,
      percent: 1n << 31n,
      minBond: 1000n,
      minInsurance: 50n,
    },
  },
  {
    newLiquidityParams: {
      assetIn: 10000n,
      debtIn: 12000n,
      collateralIn: 1000n,
    },
    lendGivenPercentParams: {
      assetIn: 100000n,
      percent: 2n << 31n,
      minBond: 0n,
      minInsurance: 0n,
    },
  },
  {
    newLiquidityParams: {
      assetIn: 10000n,
      debtIn: 12000n,
      collateralIn: 1000n,
    },
    lendGivenPercentParams: {
      assetIn: 500n,
      percent: 4n << 30n,
      minBond: 0n,
      minInsurance: 0n,
    },
  },
  {
    newLiquidityParams: {
      assetIn: 10000n,
      debtIn: 12000n,
      collateralIn: 1000n,
    },
    lendGivenPercentParams: {
      assetIn: 1000000000n,
      percent: 2n << 30n,
      minBond: 0n,
      minInsurance: 0n,
    },
  },
  {
    newLiquidityParams: {
      assetIn: 10000n,
      debtIn: 12000n,
      collateralIn: 1000n,
    },
    lendGivenPercentParams: {
      assetIn: 67900000000n,
      percent: 1n << 31n,
      minBond: 0n,
      minInsurance: 0n,
    },
  },
]

describe('Lend Given Percent', () => {
  testCases.forEach((testCase, index) => {
    it(`Succeeded ${index}`, async () => {
      const { maturity, assetToken, collateralToken } = await loadFixture(fixture)
      let currentTime = await now()

      const constructorFixture = await loadFixture(fixture)
      await setTime(Number(currentTime + 5000n))
      const newLiquidity = await newLiquidityFixture(constructorFixture, signers[0], testCase.newLiquidityParams)
      await setTime(Number(currentTime + 10000n))
      const lendGivenPercent = await lendGivenPercentFixture(newLiquidity, signers[0], testCase.lendGivenPercentParams)

      await lendGivenPercentProperties(
        testCase,
        currentTime,
        lendGivenPercent,
        assetToken.address,
        collateralToken.address
      )
    })
  })
})

describe('Lend Given Percent ETH Asset', () => {
  testCases.forEach((testCase, index) => {
    it(`Succeeded ${index}`, async () => {
      const { maturity, convenience, collateralToken } = await loadFixture(fixture)
      let currentTime = await now()

      const constructorFixture = await loadFixture(fixture)
      await setTime(Number(currentTime + 5000n))
      const newLiquidity = await newLiquidityETHAssetFixture(constructorFixture, signers[0], testCase.newLiquidityParams)
      await setTime(Number(currentTime + 10000n))
      const lendGivenPercent = await lendGivenPercentETHAssetFixture(newLiquidity, signers[0], testCase.lendGivenPercentParams)

      await lendGivenPercentProperties(testCase, currentTime, lendGivenPercent, convenience.wethContract.address, collateralToken.address)
    })
  })
})
describe('Lend Given Percent ETH Collateral', () => {
  testCases.forEach((testCase, index) => {
    it(`Succeeded ${index}`, async () => {
      const { maturity, convenience, assetToken } = await loadFixture(fixture)
      let currentTime = await now()

      const constructorFixture = await loadFixture(fixture)
      await setTime(Number(currentTime + 5000n))
      const newLiquidity = await newLiquidityETHCollateralFixture(constructorFixture, signers[0], testCase.newLiquidityParams)
      await setTime(Number(currentTime + 10000n))
      const lendGivenPercent = await lendGivenPercentETHCollateralFixture(newLiquidity, signers[0], testCase.lendGivenPercentParams)

      await lendGivenPercentProperties(testCase, currentTime, lendGivenPercent, assetToken.address, convenience.wethContract.address)
    })
  })
})

// describe('Lend Given Percent', () => {
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
//             lendGivenPercentParams: fc.record({
//               assetIn: fc.bigUintN(50),
//               percent: fc.bigUint(1n << 32n),
//               minInsurance: fc.bigUintN(50),
//               minBond: fc.bigUintN(50),
//             }),
//           })
//           .filter((x) => LendFilter.lendGivenPercentSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
//           .noShrink(),
//         async (data) => {
//           const success = async () => {
//             const constructor = await loadFixture(fixture)
//             await setTime(Number(currentTime + 5000n))
//             const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
//             await setTime(Number(currentTime + 10000n))
//             const lendGivenBond = await lendGivenPercentFixture(newLiquidity, signers[0], data.lendGivenPercentParams)
//             return lendGivenBond
//           }

//           await lendGivenPercentProperties(data, currentTime, success, assetToken.address, collateralToken.address)
//         }
//       ),
//       { skipAllAfterTimeLimit: 50000, numRuns: 10 }
//     )
//   }).timeout(100000)
// })

// describe('Lend Given Percent ETH Asset', () => {
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
//             lendGivenPercentParams: fc.record({
//               assetIn: fc.bigUintN(50),
//               percent: fc.bigUint(1n << 32n),
//               minInsurance: fc.bigUintN(50),
//               minBond: fc.bigUintN(50),
//             }),
//           })
//           .filter((x) => LendFilter.lendGivenPercentSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
//           .noShrink(),
//         async (data) => {
//           const success = async () => {
//             const constructor = await loadFixture(fixture)
//             await setTime(Number(currentTime + 5000n))
//             const newLiquidity = await newLiquidityETHAssetFixture(constructor, signers[0], data.newLiquidityParams)
//             await setTime(Number(currentTime + 10000n))
//             const lendGivenBond = await lendGivenPercentETHAssetFixture(
//               newLiquidity,
//               signers[0],
//               data.lendGivenPercentParams
//             )
//             return lendGivenBond
//           }

//           await lendGivenPercentProperties(
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
// })

// describe('Lend Given Percent ETH Collateral', () => {
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
//             lendGivenPercentParams: fc.record({
//               assetIn: fc.bigUintN(50),
//               percent: fc.bigUint(1n << 32n),
//               minInsurance: fc.bigUintN(50),
//               minBond: fc.bigUintN(50),
//             }),
//           })
//           .filter((x) => LendFilter.lendGivenPercentSuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
//           .noShrink(),
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
//             const lendGivenBond = await lendGivenPercentETHCollateralFixture(
//               newLiquidity,
//               signers[0],
//               data.lendGivenPercentParams
//             )
//             return lendGivenBond
//           }

//           await lendGivenPercentProperties(
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
// })

async function lendGivenPercentProperties(
  data: {
    newLiquidityParams: {
      assetIn: bigint
      debtIn: bigint
      collateralIn: bigint
    }
    lendGivenPercentParams: {
      assetIn: bigint
      percent: bigint
      minInsurance: bigint
      minBond: bigint
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
  const { yDecrease: yDecreaseLendGivenPercent, zDecrease: zDecreaseLendGivenPercent } =
    LendMath.getLendGivenPercentParams(
      state,
      FEE,
      PROTOCOL_FEE,
      maturity,
      currentTime + 10_000n,
      data.lendGivenPercentParams.assetIn,
      data.lendGivenPercentParams.percent
    )

  const delState = {
    x: data.lendGivenPercentParams.assetIn,
    y: yDecreaseLendGivenPercent,
    z: zDecreaseLendGivenPercent,
  }
  // const bond = LendMath.getBond(delState, maturity, currentTime + 10_000n)
  // const insurance = LendMath.getInsurance(state, delState, maturity, currentTime + 10_000n)

  // const natives = await result.convenience.getNatives(assetAddress, collateralAddress, result.maturity)

  // const bondToken = Bond__factory.connect(natives.bond, ethers.provider)
  // const insuranceToken = Insurance__factory.connect(natives.insurance, ethers.provider)

  // const bondContractBalance = (await bondToken.balanceOf(signers[0].address)).toBigInt()
  // const insuranceContractBalance = (await insuranceToken.balanceOf(signers[0].address)).toBigInt()

  // expect(bondContractBalance).equalBigInt(bond)
  // expect(insuranceContractBalance).equalBigInt(insurance)
}
