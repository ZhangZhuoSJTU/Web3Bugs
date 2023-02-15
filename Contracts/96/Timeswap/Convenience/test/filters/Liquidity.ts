import * as LiquidityMath from '../libraries/LiquidityMath'
import { AddLiquidityGivenAssetParams, NewLiquidityParams, RemoveLiquidityParams } from '../types'
const MAXUINT112: bigint = 2n ** 112n

export function newLiquiditySuccess(newLiquidityParams: NewLiquidityParams, currentTime: bigint, maturity: bigint) {
  if (newLiquidityParams.assetIn <= 0 || newLiquidityParams.debtIn - newLiquidityParams.assetIn <= 0) {
    return false
  }
  const maybeLiqudityParams = LiquidityMath.getNewLiquidityParams(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTime,
    maturity
  )
  if(maybeLiqudityParams!=false){
  const { xIncreaseNewLiquidity, yIncreaseNewLiquidity, zIncreaseNewLiquidity } =  maybeLiqudityParams

  if (
    !(
      xIncreaseNewLiquidity >0n &&
      xIncreaseNewLiquidity < MAXUINT112 &&
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
return false
}

export function newLiquidityError(newLiquidityParams: NewLiquidityParams, currentTime: bigint, maturity: bigint) {
  if (newLiquidityParams.assetIn < 0 || newLiquidityParams.debtIn - newLiquidityParams.assetIn <= 0) {
    return { data: newLiquidityParams, error: '' }
  }
  const maybeNewLiquidityParams = LiquidityMath.getNewLiquidityParams(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTime,
    maturity
  )
  if(maybeNewLiquidityParams!=false){
  const { xIncreaseNewLiquidity, yIncreaseNewLiquidity, zIncreaseNewLiquidity } = maybeNewLiquidityParams

  if (!(yIncreaseNewLiquidity < MAXUINT112 && zIncreaseNewLiquidity < MAXUINT112)) {
    return { data: newLiquidityParams, error: '' }
  }

  if (!(yIncreaseNewLiquidity > 0n && zIncreaseNewLiquidity > 0n)) {
    return { data: newLiquidityParams, error: '' }
  }
  
  return { data: newLiquidityParams, error: '' }
}
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
  const maybeParams = LiquidityMath.getNewLiquidityParams(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTimeNL,
    maturity
  )
  if(maybeParams !=false){
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = maybeParams
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  const { yIncreaseAddLiquidity, zIncreaseAddLiquidity } = LiquidityMath.getAddLiquidityGivenAssetParams(
    state,
    addLiquidityParams.assetIn,
    0n
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
  const liquidityNew = LiquidityMath.getInitialLiquidity(state.x)
  const debt = LiquidityMath.getDebtAddLiquidity(delState, maturity, currentTimeAL)
  const collateral = LiquidityMath.getCollateralAddLiquidity(delState, maturity, currentTimeAL)
  const liquidityAdd = LiquidityMath.getLiquidity(state, delState, currentTimeAL, maturity)
console.log('Min liq conv',addLiquidityParams.minLiquidity)
console.log(liquidityAdd)
if (
    typeof(liquidityAdd) == 'string' ||
    addLiquidityParams.maxDebt < debt ||
    addLiquidityParams.maxCollateral < collateral ||
    addLiquidityParams.minLiquidity >= liquidityAdd ||
    debt > MAXUINT112 ||
    collateral > MAXUINT112 
    
  )
    return false

  return true
  }
  return false
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
  const maybeParams = LiquidityMath.getNewLiquidityParams(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTimeNL,
    maturity
  )
  if(maybeParams!=false){
  const { xIncreaseNewLiquidity, yIncreaseNewLiquidity, zIncreaseNewLiquidity } = maybeParams
  const state = { x: xIncreaseNewLiquidity, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  const { yIncreaseAddLiquidity, zIncreaseAddLiquidity } = LiquidityMath.getAddLiquidityGivenAssetParams(
    state,
    addLiquidityParams.assetIn,
    0n
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
  const liquidityNew = LiquidityMath.getInitialLiquidity(state.x)
  const debt = LiquidityMath.getDebtAddLiquidity(delState, maturity, currentTimeAL)
  const collateral = LiquidityMath.getCollateralAddLiquidity(delState, maturity, currentTimeAL)
  const liquidityAdd = LiquidityMath.getLiquidity(state, delState, currentTimeAL, maturity)

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
return { data: liquidityParams, error: '' }
}
// export function removeLiquiditySuccess(
//   liquidityParams: { newLiquidityParams: NewLiquidityParams; removeLiquidityParams: RemoveLiquidityParams },
//   currentTime: bigint,
//   maturity: bigint
// ) {
//   const { newLiquidityParams, removeLiquidityParams } = liquidityParams
//   if (removeLiquidityParams.liquidityIn <= 0) return false
//   const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
//     newLiquidityParams.assetIn,
//     newLiquidityParams.debtIn,
//     newLiquidityParams.collateralIn,
//     currentTime,
//     maturity
//   )
//   const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
//   const liquidity = LiquidityMath.liquidityCalculateNewLiquidity(state, currentTime, maturity)
//   if (removeLiquidityParams.liquidityIn > liquidity) return false
//   return true
// }

// export function removeLiquidityError(
//   liquidityParams: { newLiquidityParams: NewLiquidityParams; removeLiquidityParams: RemoveLiquidityParams },
//   currentTime: bigint,
//   maturity: bigint
// ) {
//   const { newLiquidityParams, removeLiquidityParams } = liquidityParams
//   if (removeLiquidityParams.liquidityIn <= 0) {
//     return { data: liquidityParams, error: 'E205' }
//   }
//   const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
//     newLiquidityParams.assetIn,
//     newLiquidityParams.debtIn,
//     newLiquidityParams.collateralIn,
//     currentTime,
//     maturity
//   )
//   const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
//   const liquidity = LiquidityMath.liquidityCalculateNewLiquidity(state, currentTime, maturity)
//   if (removeLiquidityParams.liquidityIn > liquidity) {
//     return { data: liquidityParams, error: '' }
//   }

//   return { data: liquidityParams, error: '' }
// }

export default {
  addLiquiditySuccess,
  newLiquiditySuccess,
  // removeLiquiditySuccess,
}
