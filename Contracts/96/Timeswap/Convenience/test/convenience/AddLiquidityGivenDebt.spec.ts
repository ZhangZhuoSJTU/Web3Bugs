import {  ethers,waffle } from 'hardhat'
import { mulDiv, now, min, shiftRightUp, mulDivUp, advanceTimeAndBlock, setTime } from '../shared/Helper'
import { expect } from '../shared/Expect'
import * as LiquidityMath from '../libraries/LiquidityMath'
import {
  newLiquidityFixture,
  constructorFixture,
  Fixture,
  liquidityGivenAssetFixture,
  newLiquidityETHAssetFixture,
  liquidityGivenAssetETHAssetFixture,
  newLiquidityETHCollateralFixture,
  liquidityGivenAssetETHCollateralFixture,
} from '../shared/Fixtures'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import * as fc from 'fast-check'
import { AddLiquidityGivenAssetParams, NewLiquidityParams } from '../types'
import { CollateralizedDebt__factory, ERC20__factory, TestToken, TimeswapPair, TimeswapPair__factory } from '../../typechain'
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
      collateralIn:1000n
    },
    addLiquidityParams: {
      assetIn: 10000n,
      minLiquidity:5700000n,
      maxDebt: 12000n,
      maxCollateral: 10000n,
    }
  }
]



describe('Add Liquidity',()=>{
  it('Succeeded', async()=>{
    const { maturity, assetToken, collateralToken } = await loadFixture(fixture)
    let currentTime = await now()

    const constructorFixture = await loadFixture(fixture)
    await setTime(Number(currentTime+5000n))
    const newLiquidity = await newLiquidityFixture(constructorFixture,signers[0],testCases[0].newLiquidityParams)
    await setTime(Number(currentTime+10000n))
    const addLiquidity = await liquidityGivenAssetFixture(constructorFixture,signers[0],testCases[0].addLiquidityParams)
    
    await addLiquidityProperties(testCases[0],currentTime,addLiquidity,assetToken.address,collateralToken.address)

  })
})
// describe('Add Liquidity', () => {
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
//             addLiquidityParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               minLiquidity: fc.bigUintN(256),
//               maxDebt: fc.bigUintN(112),
//               maxCollateral: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => LiquidityFilter.addLiquiditySuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)).noShrink(),
//         async (data) => {
//           const success = async () => {
//             const constructor = await loadFixture(fixture)
//             await setTime(Number(currentTime + 5000n))
//             const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
//             await setTime(Number(currentTime + 10000n))
//             const addLiquidity = await liquidityGivenAssetFixture(newLiquidity, signers[0], data.addLiquidityParams)
//             return addLiquidity
//           }

//           await addLiquidityProperties(data, currentTime, success, assetToken.address, collateralToken.address)
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
//             addLiquidityParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               minLiquidity: fc.bigUintN(256),
//               maxDebt: fc.bigUintN(112),
//               maxCollateral: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => !LiquidityFilter.addLiquiditySuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
//           .map((x) => LiquidityFilter.addLiquidityError(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
//         async ({ data, error }) => {
//           const constructor = await loadFixture(fixture)
//           await setTime(Number(currentTime + 5000n))
//           await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
//           await setTime(Number(currentTime + 10000n))

//           await expect(
//             constructor.convenience.convenienceContract.liquidityGivenAsset({
//               asset: assetToken.address,
//               collateral: collateralToken.address,
//               maturity,
//               liquidityTo: signers[0].address,
//               dueTo: signers[0].address,
//               assetIn: data.addLiquidityParams.assetIn,
//               minLiquidity: data.addLiquidityParams.minLiquidity,
//               maxDebt: data.addLiquidityParams.maxDebt,
//               maxCollateral: data.addLiquidityParams.maxCollateral,
//               deadline: maturity,
//             })
//           ).to.be.revertedWith(error)
//         }
//       ),
//       { skipAllAfterTimeLimit: 50000, numRuns: 10 }
//     )
//   }).timeout(100000)
// })

// describe('Add Liquidity ETH Asset', () => {
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
//             addLiquidityParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               minLiquidity: fc.bigUintN(256),
//               maxDebt: fc.bigUintN(112),
//               maxCollateral: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => LiquidityFilter.addLiquiditySuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
//         async (data) => {
//           const success = async () => {
//             const constructor = await loadFixture(fixture)
//             await setTime(Number(currentTime + 5000n))
//             const newLiquidity = await newLiquidityETHAssetFixture(constructor, signers[0], data.newLiquidityParams)
//             await setTime(Number(currentTime + 10000n))
//             const addLiquidity = await liquidityGivenAssetETHAssetFixture(newLiquidity, signers[0], data.addLiquidityParams)
//             return addLiquidity
//           }

//           await addLiquidityProperties(
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
//             addLiquidityParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               minLiquidity: fc.bigUintN(256),
//               maxDebt: fc.bigUintN(112),
//               maxCollateral: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => !LiquidityFilter.addLiquiditySuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
//           .map((x) => LiquidityFilter.addLiquidityError(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
//         async ({ data, error }) => {
//           const constructor = await loadFixture(fixture)
//           await setTime(Number(currentTime + 5000n))
//           await newLiquidityETHAssetFixture(constructor, signers[0], data.newLiquidityParams)
//           await setTime(Number(currentTime + 10000n))

//           await expect(
//             constructor.convenience.convenienceContract.liquidityGivenAssetETHAsset(
//               {
//                 collateral: collateralToken.address,
//                 maturity,
//                 liquidityTo: signers[0].address,
//                 dueTo: signers[0].address,
//                 minLiquidity: data.addLiquidityParams.minLiquidity,
//                 maxDebt: data.addLiquidityParams.maxDebt,
//                 maxCollateral: data.addLiquidityParams.maxCollateral,
//                 deadline: maturity,
//               },
//               { value: data.addLiquidityParams.assetIn }
//             )
//           ).to.be.revertedWith(error)
//         }
//       ),
//       { skipAllAfterTimeLimit: 50000, numRuns: 10 }
//     )
//   }).timeout(100000)
// })

// describe('Add Liquidity ETH Collateral', () => {
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
//             addLiquidityParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               minLiquidity: fc.bigUintN(256),
//               maxDebt: fc.bigUintN(112),
//               maxCollateral: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => LiquidityFilter.addLiquiditySuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
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
//             const addLiquidity = await liquidityGivenAssetETHCollateralFixture(
//               newLiquidity,
//               signers[0],
//               data.addLiquidityParams
//             )
//             return addLiquidity
//           }

//           await addLiquidityProperties(data, currentTime, success, assetToken.address, convenience.wethContract.address)
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
//             addLiquidityParams: fc.record({
//               assetIn: fc.bigUintN(112),
//               minLiquidity: fc.bigUintN(256),
//               maxDebt: fc.bigUintN(112),
//               maxCollateral: fc.bigUintN(112),
//             }),
//           })
//           .filter((x) => !LiquidityFilter.addLiquiditySuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
//           .map((x) => LiquidityFilter.addLiquidityError(x, currentTime + 5_000n, currentTime + 10_000n, maturity))
//           .noShrink(),
//         async ({ data, error }) => {
//           const constructor = await loadFixture(fixture)
//           await setTime(Number(currentTime + 5000n))
//           await newLiquidityETHCollateralFixture(constructor, signers[0], data.newLiquidityParams)
//           await setTime(Number(currentTime + 10000n))

//           await expect(
//             constructor.convenience.convenienceContract.liquidityGivenAssetETHCollateral(
//               {
//                 asset: assetToken.address,
//                 maturity,
//                 liquidityTo: signers[0].address,
//                 dueTo: signers[0].address,
//                 assetIn: data.addLiquidityParams.assetIn,
//                 minLiquidity: data.addLiquidityParams.minLiquidity,
//                 maxDebt: data.addLiquidityParams.maxDebt,
//                 deadline: maturity,
//               },
//               { value: data.addLiquidityParams.maxCollateral }
//             )
//           ).to.be.reverted 
//         }
//       ),
//       { skipAllAfterTimeLimit: 50000, numRuns: 10, seed: 1195527756 }
//     )
//   }).timeout(100000)
// })

async function addLiquidityProperties(
  data: {
    newLiquidityParams: {
      assetIn: bigint
      debtIn: bigint
      collateralIn: bigint
    }
    addLiquidityParams: {
      assetIn: bigint
      minLiquidity: bigint
      maxDebt: bigint
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
  let { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = { yIncreaseNewLiquidity:0n, zIncreaseNewLiquidity:0n }
  if(maybeNewMintParams!=false){
    yIncreaseNewLiquidity = maybeNewMintParams.yIncreaseNewLiquidity
    zIncreaseNewLiquidity = maybeNewMintParams.zIncreaseNewLiquidity

  }

  const state = {
    x: data.newLiquidityParams.assetIn,
    y: yIncreaseNewLiquidity,
    z: zIncreaseNewLiquidity,
  }
  const { yIncreaseAddLiquidity, zIncreaseAddLiquidity } = LiquidityMath.getAddLiquidityGivenAssetParams(
    state,
    data.addLiquidityParams.assetIn,
    50n*5_000n
  )
  const delState = {
    x: data.addLiquidityParams.assetIn,
    y: yIncreaseAddLiquidity,
    z: zIncreaseAddLiquidity,
  }
  const liquidityBalanceNew = LiquidityMath.getInitialLiquidity(
    data.newLiquidityParams.assetIn
  )

  const maybeLiquidityBalanceAdd = LiquidityMath.getLiquidity(
    state,
    delState,
    currentTime + 10_000n,
    maturity
  )
  let liquidityBalanceAdd=0n
  if(typeof(maybeLiquidityBalanceAdd)!='string'){
    liquidityBalanceAdd = maybeLiquidityBalanceAdd
  }
  const liquidityBalance = liquidityBalanceNew + liquidityBalanceAdd

  const debt = LiquidityMath.getDebtAddLiquidity(
    { x: data.addLiquidityParams.assetIn, y: yIncreaseAddLiquidity, z: zIncreaseAddLiquidity },
    maturity,
    currentTime + 10_000n
  )
  const collateral = LiquidityMath.getCollateralAddLiquidity(
    { x: data.addLiquidityParams.assetIn, y: yIncreaseAddLiquidity, z: zIncreaseAddLiquidity },
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
