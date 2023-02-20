import * as LiquidityMath from '../libraries/LiquidityMath'
import { AddLiquidityGivenAssetParams, NewLiquidityParams, RemoveLiquidityParams } from '../types'
const MAXUINT112: bigint = 2n ** 112n

export function newLiquiditySuccess(newLiquidityParams: NewLiquidityParams, currentTime: bigint, maturity: bigint) {
  if (newLiquidityParams.assetIn <= 0 || newLiquidityParams.debtIn - newLiquidityParams.assetIn <= 0) {
    return false
  }
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTime,
    maturity
  )

  if (
    !(
      yIncreaseNewLiquidity > 0n &&
      zIncreaseNewLiquidity > 0n &&
      yIncreaseNewLiquidity < MAXUINT112 &&
      zIncreaseNewLiquidity < MAXUINT112
    )
  ) {
    return false
  }
  const collateral =LiquidityMath.getCollateralAddLiquidity(
    {x:newLiquidityParams.assetIn,y:yIncreaseNewLiquidity,z:zIncreaseNewLiquidity},
    maturity,currentTime)
    console.log('collateral TS',collateral)
  const debt = LiquidityMath.getDebtAddLiquidity(
    {x:newLiquidityParams.assetIn,y:yIncreaseNewLiquidity,z:zIncreaseNewLiquidity},
    maturity,currentTime)
  if(!(
    collateral > 0n &&
    debt > 0n &&
    collateral < MAXUINT112 &&
    debt < MAXUINT112
  )){
    return false
  }
  return true
}

export function newLiquidityError(newLiquidityParams: NewLiquidityParams, currentTime: bigint, maturity: bigint) {
  if (newLiquidityParams.assetIn < 0 || newLiquidityParams.debtIn - newLiquidityParams.assetIn <= 0) {
    return { data: newLiquidityParams, error: '' }
  }
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTime,
    maturity
  )

  if (!(yIncreaseNewLiquidity < MAXUINT112 && zIncreaseNewLiquidity < MAXUINT112)) {
    return { data: newLiquidityParams, error: '' }
  }

  if (!(yIncreaseNewLiquidity > 0n && zIncreaseNewLiquidity > 0n)) {
    return { data: newLiquidityParams, error: '' }
  }

  return { data: newLiquidityParams, error: '' }
}

export function addLiquiditySuccess(
  liquidityParams: { newLiquidityParams: NewLiquidityParams; addLiquidityParams: AddLiquidityGivenAssetParams },
  currentTimeNL: bigint,
  currentTimeAL: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, addLiquidityParams } = liquidityParams

  if (
    addLiquidityParams.assetIn <= 0 ||
    addLiquidityParams.maxDebt <= 0 ||
    addLiquidityParams.maxCollateral <= 0 ||
    addLiquidityParams.minLiquidity <= 0
  ) {
    return false
  }
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTimeNL,
    maturity
  )
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  const { yIncreaseAddLiquidity, zIncreaseAddLiquidity } = LiquidityMath.getYandZIncreaseAddLiquidity(
    state,
    addLiquidityParams.assetIn
  )

  if (
    !(
      yIncreaseAddLiquidity > 0n &&
      zIncreaseAddLiquidity > 0n &&
      yIncreaseAddLiquidity + state.y < MAXUINT112 &&
      zIncreaseAddLiquidity + state.z < MAXUINT112 &&
      addLiquidityParams.assetIn + state.x < MAXUINT112
    )
  ) {
    return false
  }

  const delState = { x: addLiquidityParams.assetIn, y: yIncreaseAddLiquidity, z: zIncreaseAddLiquidity }
  const liquidityNew = LiquidityMath.liquidityCalculateNewLiquidity(state, currentTimeNL, maturity)
  const debt = LiquidityMath.getDebtAddLiquidity(delState, maturity, currentTimeAL)
  const collateral = LiquidityMath.getCollateralAddLiquidity(delState, maturity, currentTimeAL)
  const liquidityAdd = LiquidityMath.liquidityCalculateAddLiquidity(state, delState, currentTimeAL, maturity)

  if (
    addLiquidityParams.maxDebt < debt ||
    addLiquidityParams.maxCollateral < collateral ||
    addLiquidityParams.minLiquidity > liquidityAdd ||
    debt > MAXUINT112 ||
    collateral > MAXUINT112
  )
    return false

  return true
}

export function addLiquidityError(
  liquidityParams: { newLiquidityParams: NewLiquidityParams; addLiquidityParams: AddLiquidityGivenAssetParams },
  currentTimeNL: bigint,
  currentTimeAL: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, addLiquidityParams } = liquidityParams

  if (
    addLiquidityParams.assetIn <= 0 ||
    addLiquidityParams.maxDebt <= 0 ||
    addLiquidityParams.maxCollateral <= 0 ||
    addLiquidityParams.minLiquidity <= 0
  ) {
    return { data: liquidityParams, error: '' }
  }
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTimeNL,
    maturity
  )
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  const { yIncreaseAddLiquidity, zIncreaseAddLiquidity } = LiquidityMath.getYandZIncreaseAddLiquidity(
    state,
    addLiquidityParams.assetIn
  )

  if (
    !(
      yIncreaseAddLiquidity + state.y < MAXUINT112 &&
      zIncreaseAddLiquidity + state.z < MAXUINT112 &&
      addLiquidityParams.assetIn + state.x < MAXUINT112
    )
  ) {
    return { data: liquidityParams, error: '' }
  }

  if (!(yIncreaseAddLiquidity > 0n && zIncreaseAddLiquidity > 0n)) {
    return { data: liquidityParams, error: '' }
  }

  const delState = { x: addLiquidityParams.assetIn, y: yIncreaseAddLiquidity, z: zIncreaseAddLiquidity }
  const liquidityNew = LiquidityMath.liquidityCalculateNewLiquidity(state, currentTimeNL, maturity)
  const debt = LiquidityMath.getDebtAddLiquidity(delState, maturity, currentTimeAL)
  const collateral = LiquidityMath.getCollateralAddLiquidity(delState, maturity, currentTimeAL)
  const liquidityAdd = LiquidityMath.liquidityCalculateAddLiquidity(state, delState, currentTimeAL, maturity)

  if (debt > MAXUINT112 || collateral > MAXUINT112) {
    return { data: liquidityParams, error: '' }
  }

  if (addLiquidityParams.minLiquidity > liquidityAdd) {
    return { data: liquidityParams, error: 'E511' }
  }

  if (addLiquidityParams.maxDebt < debt) {
    return { data: liquidityParams, error: 'E512' }
  }

  if (addLiquidityParams.maxCollateral < collateral) {
    return { data: liquidityParams, error: 'E513' }
  }

  return { data: liquidityParams, error: '' }
}

export function removeLiquiditySuccess(
  liquidityParams: { newLiquidityParams: NewLiquidityParams; removeLiquidityParams: RemoveLiquidityParams },
  currentTime: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, removeLiquidityParams } = liquidityParams
  if (removeLiquidityParams.liquidityIn <= 0) return false
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTime,
    maturity
  )
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  const liquidity = LiquidityMath.liquidityCalculateNewLiquidity(state, currentTime, maturity)
  if (removeLiquidityParams.liquidityIn > liquidity) return false
  return true
}

export function removeLiquidityError(
  liquidityParams: { newLiquidityParams: NewLiquidityParams; removeLiquidityParams: RemoveLiquidityParams },
  currentTime: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, removeLiquidityParams } = liquidityParams
  if (removeLiquidityParams.liquidityIn <= 0) {
    return { data: liquidityParams, error: 'E205' }
  }
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTime,
    maturity
  )
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  const liquidity = LiquidityMath.liquidityCalculateNewLiquidity(state, currentTime, maturity)
  if (removeLiquidityParams.liquidityIn > liquidity) {
    return { data: liquidityParams, error: '' }
  }

  return { data: liquidityParams, error: '' }
}

export default {
  addLiquiditySuccess,
  newLiquiditySuccess,
  removeLiquiditySuccess,
}
