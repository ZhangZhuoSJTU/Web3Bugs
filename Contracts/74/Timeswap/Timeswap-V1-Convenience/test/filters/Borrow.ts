import * as BorrowMath from '../libraries/BorrowMath'
import * as LiquidityMath from '../libraries/LiquidityMath'
import {
  BorrowGivenCollateralParams, BorrowGivenDebtParams, BorrowGivenPercentParams, NewLiquidityParams, RepayParams
} from '../types'
const MAXUINT112: bigint = 2n ** 112n - 1n
function updateState(state:{x:bigint,y:bigint,z:bigint},delState:{x:bigint,y:bigint,z:bigint}){
  return {
    x: state.x + delState.x,
    y:state.y+delState.y,
    z: state.z + delState.z
  }
}
export function borrowGivenPercentSuccess(
  liquidityParams: {
    newLiquidityParams: NewLiquidityParams
    borrowGivenPercentParams: BorrowGivenPercentParams
  },
  currentTimeNL: bigint,
  currentTimeB: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, borrowGivenPercentParams } = liquidityParams

  if (borrowGivenPercentParams.assetOut <= 0 || borrowGivenPercentParams.percent > 0x100000000n) {
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

  if (state.x <= borrowGivenPercentParams.assetOut) {
    return false
  }

  const { yIncreaseBorrowGivenPercent, zIncreaseBorrowGivenPercent } = BorrowMath.getYandZIncreaseBorrowGivenPercent(
    state,
    borrowGivenPercentParams.assetOut,
    borrowGivenPercentParams.percent
  )

  if (
    !(
      yIncreaseBorrowGivenPercent > 0n &&
      zIncreaseBorrowGivenPercent > 0n &&
      yIncreaseBorrowGivenPercent + state.y <= MAXUINT112 &&
      zIncreaseBorrowGivenPercent + state.z <= MAXUINT112 &&
      state.x - borrowGivenPercentParams.assetOut > 0n
    )
  ) {
    return false
  }

  const delState = {
    x: borrowGivenPercentParams.assetOut,
    y: yIncreaseBorrowGivenPercent,
    z: zIncreaseBorrowGivenPercent,
  }
  if (!BorrowMath.check(state, delState)) {
    return false
  }
  const debt = BorrowMath.getDebt(delState, maturity, currentTimeB)
  const collateral = BorrowMath.getCollateral(state, delState, maturity, currentTimeB)

  if (
    borrowGivenPercentParams.maxDebt < debt ||
    borrowGivenPercentParams.maxCollateral < collateral ||
    debt > MAXUINT112 ||
    collateral > MAXUINT112
  )
    return false

  return true
}

export function borrowGivenDebtSuccess(
  liquidityParams: {
    newLiquidityParams: NewLiquidityParams
    borrowGivenDebtParams: BorrowGivenDebtParams
  },
  currentTimeNL: bigint,
  currentTimeB: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, borrowGivenDebtParams } = liquidityParams

  if (borrowGivenDebtParams.assetOut <= 0) {
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

  if (state.x <= borrowGivenDebtParams.assetOut) {
    return false
  }

  const { yIncreaseBorrowGivenDebt, zIncreaseBorrowGivenDebt } = BorrowMath.getYandZIncreaseBorrowGivenDebt(
    state,
    borrowGivenDebtParams.assetOut,
    maturity,
    currentTimeB,
    borrowGivenDebtParams.debtIn
  )

  if (
    !(
      yIncreaseBorrowGivenDebt > 0n &&
      zIncreaseBorrowGivenDebt > 0n &&
      yIncreaseBorrowGivenDebt + state.y <= MAXUINT112 &&
      zIncreaseBorrowGivenDebt + state.z <= MAXUINT112 &&
      state.x - borrowGivenDebtParams.assetOut > 0n
    )
  ) {
    return false
  }

  const delState = {
    x: borrowGivenDebtParams.assetOut,
    y: yIncreaseBorrowGivenDebt,
    z: zIncreaseBorrowGivenDebt,
  }
  const debt = BorrowMath.getDebt(delState, maturity, currentTimeB)
  const collateral = BorrowMath.getCollateral(state, delState, maturity, currentTimeB)
  if (!BorrowMath.check(state, delState)) {
    return false
  }
  if (debt <= 0 || borrowGivenDebtParams.maxCollateral < collateral || debt > MAXUINT112 || collateral > MAXUINT112)
    return false

  return true
}
export function borrowGivenMultipleDebtSuccess(
  liquidityParams: {
    newLiquidityParams: NewLiquidityParams
    borrowGivenDebtParamsList: BorrowGivenDebtParams[]
  },
  currentTimeNL: bigint,
  currentTimeB: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, borrowGivenDebtParamsList } = liquidityParams
  for(let i=0;i<borrowGivenDebtParamsList.length;i++){
    if (borrowGivenDebtParamsList[i].assetOut <= 0 ) {
      return false
    }
  }

  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTimeNL,
    maturity
  )
  

  let state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }

  if (state.x <= borrowGivenDebtParamsList[0].assetOut) {
    return false
  }

  const { yIncreaseBorrowGivenDebt, zIncreaseBorrowGivenDebt } = BorrowMath.getYandZIncreaseBorrowGivenDebt(
    state,
    borrowGivenDebtParamsList[0].assetOut,
    maturity,
    currentTimeB,
    borrowGivenDebtParamsList[0].debtIn
  )
  if (
    !(
      yIncreaseBorrowGivenDebt > 0n &&
      zIncreaseBorrowGivenDebt > 0n &&
      yIncreaseBorrowGivenDebt + state.y <= MAXUINT112 &&
      zIncreaseBorrowGivenDebt + state.z <= MAXUINT112 
    )
  ) {
    return false
  }


  let delState = {
    x: borrowGivenDebtParamsList[0].assetOut,
    y: yIncreaseBorrowGivenDebt,
    z: zIncreaseBorrowGivenDebt,
  }
  const debt = BorrowMath.getDebt(delState, maturity, currentTimeB)
  const collateral = BorrowMath.getCollateral(state, delState, maturity, currentTimeB)
  if (!BorrowMath.check(state, delState)) {
    return false
  }

  if (debt <= 0 || borrowGivenDebtParamsList[0].maxCollateral < collateral || debt > MAXUINT112 || collateral > MAXUINT112)
    return false

  state = updateState(state,delState)
  currentTimeB = currentTimeB+5000n

for(let i = 1;i<borrowGivenDebtParamsList.length;i++){
  
  if (state.x <= borrowGivenDebtParamsList[i].assetOut) {
    return false
  }
  const { yIncreaseBorrowGivenDebt, zIncreaseBorrowGivenDebt } = BorrowMath.getYandZIncreaseBorrowGivenDebt(
    state,
    borrowGivenDebtParamsList[i].assetOut,
    maturity,
    currentTimeB,
    borrowGivenDebtParamsList[i].debtIn
  )
  if (
    !(
      yIncreaseBorrowGivenDebt > 0n &&
      zIncreaseBorrowGivenDebt > 0n &&
      yIncreaseBorrowGivenDebt + state.y <= MAXUINT112 &&
      zIncreaseBorrowGivenDebt + state.z <= MAXUINT112 &&
      state.x - borrowGivenDebtParamsList[i].assetOut > 0n
    )
  ) {
    return false
  }


  const delState = {
    x: borrowGivenDebtParamsList[i].assetOut,
    y: yIncreaseBorrowGivenDebt,
    z: zIncreaseBorrowGivenDebt,
  }
  const debt = BorrowMath.getDebt(delState, maturity, currentTimeB)
  const collateral = BorrowMath.getCollateral(state, delState, maturity, currentTimeB)
  if (!BorrowMath.check(state, delState)) {
    return false
  }

  if (debt <= 0 || borrowGivenDebtParamsList[i].maxCollateral < collateral || debt > MAXUINT112 || collateral > MAXUINT112)
    return false

  state =  updateState(delState,state)
  currentTimeB = currentTimeB + 5000n
}

  return true
}
export function borrowGivenDebtError(
  params: {
    newLiquidityParams: NewLiquidityParams
    borrowGivenDebtParams: BorrowGivenDebtParams
  },
  currentTimeNL: bigint,
  currentTimeB: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, borrowGivenDebtParams } = params

  if (borrowGivenDebtParams.assetOut <= 0) {
    return { data: params, error: 'E205' }
  }
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTimeNL,
    maturity
  )
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }

  if (state.x <= borrowGivenDebtParams.assetOut) {
    return { data: params, error: '' }
  }

  const { yIncreaseBorrowGivenDebt, zIncreaseBorrowGivenDebt } = BorrowMath.getYandZIncreaseBorrowGivenDebt(
    state,
    borrowGivenDebtParams.assetOut,
    maturity,
    currentTimeB,
    borrowGivenDebtParams.debtIn
  )

  if (
    !(
      yIncreaseBorrowGivenDebt > 0n &&
      zIncreaseBorrowGivenDebt > 0n &&
      yIncreaseBorrowGivenDebt + state.y <= MAXUINT112 &&
      zIncreaseBorrowGivenDebt + state.z <= MAXUINT112 &&
      state.x - borrowGivenDebtParams.assetOut > 0n
    )
  ) {
    return { data: params, error: '' }
  }

  const delState = {
    x: borrowGivenDebtParams.assetOut,
    y: yIncreaseBorrowGivenDebt,
    z: zIncreaseBorrowGivenDebt,
  }
  const debt = BorrowMath.getDebt(delState, maturity, currentTimeB)
  const collateral = BorrowMath.getCollateral(state, delState, maturity, currentTimeB)
  if (!BorrowMath.check(state, delState)) {
    return { data: params, error: BorrowMath.checkError(state, delState) }
  }
  if (debt <= 0 || debt > MAXUINT112 || collateral > MAXUINT112) return { data: params, error: '' }

  if (borrowGivenDebtParams.maxCollateral < collateral) return { data: params, error: 'E513' }

  return { data: params, error: '' }
}

export function borrowGivenCollateralSuccess(
  liquidityParams: {
    newLiquidityParams: NewLiquidityParams
    borrowGivenCollateralParams: BorrowGivenCollateralParams
  },
  currentTimeNL: bigint,
  currentTimeB: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, borrowGivenCollateralParams } = liquidityParams

  if (borrowGivenCollateralParams.assetOut <= 0) {
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

  if (state.x <= borrowGivenCollateralParams.assetOut) {
    return false
  }
  if (
    !BorrowMath.verifyYandZIncreaseBorrowGivenCollateral(
      state,
      borrowGivenCollateralParams.assetOut,
      maturity,
      currentTimeB,
      borrowGivenCollateralParams.collateralIn
    )
  )
    return false

  const { yIncreaseBorrowGivenCollateral, zIncreaseBorrowGivenCollateral } =
    BorrowMath.getYandZIncreaseBorrowGivenCollateral(
      state,
      borrowGivenCollateralParams.assetOut,
      maturity,
      currentTimeB,
      borrowGivenCollateralParams.collateralIn
    )

  if (
    !(
      yIncreaseBorrowGivenCollateral > 0n &&
      zIncreaseBorrowGivenCollateral > 0n &&
      yIncreaseBorrowGivenCollateral + state.y <= MAXUINT112 &&
      zIncreaseBorrowGivenCollateral + state.z <= MAXUINT112 &&
      state.x - borrowGivenCollateralParams.assetOut > 0n
    )
  ) {
    return false
  }

  const delState = {
    x: borrowGivenCollateralParams.assetOut,
    y: yIncreaseBorrowGivenCollateral,
    z: zIncreaseBorrowGivenCollateral,
  }
  if (!BorrowMath.check(state, delState)) {
    return false
  }
  const debt = BorrowMath.getDebt(delState, maturity, currentTimeB)
  const collateral = BorrowMath.getCollateral(state, delState, maturity, currentTimeB)

  if (borrowGivenCollateralParams.maxDebt < debt || collateral <= 0 || debt > MAXUINT112 || collateral > MAXUINT112)
    return false

  return true
}

export function borrowGivenCollateralError(
  params: {
    newLiquidityParams: NewLiquidityParams
    borrowGivenCollateralParams: BorrowGivenCollateralParams
  },
  currentTimeNL: bigint,
  currentTimeB: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, borrowGivenCollateralParams } = params

  if (borrowGivenCollateralParams.assetOut <= 0) {
    return { data: params, error: 'E205' }
  }
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTimeNL,
    maturity
  )
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }

  if (state.x <= borrowGivenCollateralParams.assetOut) {
    return { data: params, error: '' }
  }

  const { yIncreaseBorrowGivenCollateral, zIncreaseBorrowGivenCollateral } =
    BorrowMath.getYandZIncreaseBorrowGivenCollateral(
      state,
      borrowGivenCollateralParams.assetOut,
      maturity,
      currentTimeB,
      borrowGivenCollateralParams.collateralIn
    )

  if (
    !(
      yIncreaseBorrowGivenCollateral > 0n &&
      zIncreaseBorrowGivenCollateral > 0n &&
      yIncreaseBorrowGivenCollateral + state.y <= MAXUINT112 &&
      zIncreaseBorrowGivenCollateral + state.z <= MAXUINT112 &&
      state.x - borrowGivenCollateralParams.assetOut > 0n
    )
  ) {
    return { data: params, error: '' }
  }

  const delState = {
    x: borrowGivenCollateralParams.assetOut,
    y: yIncreaseBorrowGivenCollateral,
    z: zIncreaseBorrowGivenCollateral,
  }
  if (!BorrowMath.check(state, delState)) {
    return { data: params, error: BorrowMath.checkError(state, delState) }
  }
  const debt = BorrowMath.getDebt(delState, maturity, currentTimeB)
  const collateral = BorrowMath.getCollateral(state, delState, maturity, currentTimeB)

  if (collateral <= 0 || debt > MAXUINT112 || collateral > MAXUINT112) return { data: params, error: '' }
  if (borrowGivenCollateralParams.maxDebt < debt) return { data: params, error: 'E512' }

  return { data: params, error: '' }
}

export function repaySuccess(
  liquidityParams: {
    newLiquidityParams: NewLiquidityParams
    borrowGivenPercentParams: BorrowGivenPercentParams
    repayParams: RepayParams
  },
  currentTimeNL: bigint,
  currentTimeB: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, borrowGivenPercentParams, repayParams } = liquidityParams

  if (borrowGivenPercentParams.assetOut <= 0 || borrowGivenPercentParams.percent > 0x100000000n) {
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

  if (state.x <= borrowGivenPercentParams.assetOut) {
    return false
  }

  const { yIncreaseBorrowGivenPercent, zIncreaseBorrowGivenPercent } = BorrowMath.getYandZIncreaseBorrowGivenPercent(
    state,
    borrowGivenPercentParams.assetOut,
    borrowGivenPercentParams.percent
  )

  if (
    !(
      yIncreaseBorrowGivenPercent > 0n &&
      zIncreaseBorrowGivenPercent > 0n &&
      yIncreaseBorrowGivenPercent + state.y <= MAXUINT112 &&
      zIncreaseBorrowGivenPercent + state.z <= MAXUINT112 &&
      state.x - borrowGivenPercentParams.assetOut > 0n
    )
  ) {
    return false
  }

  const delState = {
    x: borrowGivenPercentParams.assetOut,
    y: yIncreaseBorrowGivenPercent,
    z: zIncreaseBorrowGivenPercent,
  }
  if (!BorrowMath.check(state, delState)) {
    return false
  }
  const debt = BorrowMath.getDebt(delState, maturity, currentTimeB)
  const collateral = BorrowMath.getCollateral(state, delState, maturity, currentTimeB)

  if (
    borrowGivenPercentParams.maxDebt < debt ||
    borrowGivenPercentParams.maxCollateral < collateral ||
    debt > MAXUINT112 ||
    collateral > MAXUINT112
  )
    return false
  return true
}

export default {
  borrowGivenPercentSuccess,
}
