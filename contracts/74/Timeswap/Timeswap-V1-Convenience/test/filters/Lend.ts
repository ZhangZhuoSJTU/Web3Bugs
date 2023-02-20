import {
  LendGivenBondParams,
  LendGivenInsuranceParams,
  NewLiquidityParams,
  LendGivenPercentParams,
  CollectParams,
} from '../types'
import * as LiquidityMath from '../libraries/LiquidityMath'
import * as LendMath from '../libraries/LendMath'
const MAXUINT112: bigint = 2n ** 112n

export function lendGivenBondSuccess(
  params: { newLiquidityParams: NewLiquidityParams; lendGivenBondParams: LendGivenBondParams },
  currentTimeNL: bigint,
  currentTimeLGB: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, lendGivenBondParams } = params
  if (
    lendGivenBondParams.assetIn <= 0 ||
    lendGivenBondParams.bondOut <= 0 ||
    lendGivenBondParams.minInsurance <= 0 ||
    lendGivenBondParams.bondOut - lendGivenBondParams.assetIn <= 0
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
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  if (
    !LendMath.verifyYAndZDecreaseLendGivenBond(
      state,
      maturity,
      currentTimeLGB,
      lendGivenBondParams.assetIn,
      lendGivenBondParams.bondOut
    )
  ) {
    return false
  }
  const { yDecreaseLendGivenBond, zDecreaseLendGivenBond } = LendMath.calcYAndZDecreaseLendGivenBond(
    state,
    maturity,
    currentTimeLGB,
    lendGivenBondParams.assetIn,
    lendGivenBondParams.bondOut
  )
  if (
    !(yDecreaseLendGivenBond > 0n && zDecreaseLendGivenBond > 0n && lendGivenBondParams.assetIn + state.x < MAXUINT112)
  ) {
    return false
  }
  const delState = { x: lendGivenBondParams.assetIn, y: yDecreaseLendGivenBond, z: zDecreaseLendGivenBond }
  if (!LendMath.check(state, delState)) {
    return false
  }
  if (LendMath.getInsurance(state, delState, maturity, currentTimeLGB) < lendGivenBondParams.minInsurance) {
    return false
  }
  return true
}
export function lendGivenBondError(
  params: { newLiquidityParams: NewLiquidityParams; lendGivenBondParams: LendGivenBondParams },
  currentTimeNL: bigint,
  currentTimeLGB: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, lendGivenBondParams } = params
  if (lendGivenBondParams.assetIn <= 0) {
    return { data: params, error: '' }
  }
  if (
    lendGivenBondParams.bondOut <= 0 ||
    lendGivenBondParams.minInsurance <= 0 ||
    lendGivenBondParams.bondOut - lendGivenBondParams.assetIn <= 0
  ) {
    return { data: params, error: '' }
  }
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTimeNL,
    maturity
  )
  if (!(yIncreaseNewLiquidity < MAXUINT112 && zIncreaseNewLiquidity < MAXUINT112)) {
    return { data: params, error: '' }
  }

  if (!(yIncreaseNewLiquidity > 0n && zIncreaseNewLiquidity > 0n)) {
    return { data: params, error: '' }
  }
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  if (
    !LendMath.verifyYAndZDecreaseLendGivenBond(
      state,
      maturity,
      currentTimeLGB,
      lendGivenBondParams.assetIn,
      lendGivenBondParams.bondOut
    )
  ) {
    return { data: params, error: '' }
  }
  const { yDecreaseLendGivenBond, zDecreaseLendGivenBond } = LendMath.calcYAndZDecreaseLendGivenBond(
    state,
    maturity,
    currentTimeLGB,
    lendGivenBondParams.assetIn,
    lendGivenBondParams.bondOut
  )
  if (
    !(yDecreaseLendGivenBond > 0n && zDecreaseLendGivenBond > 0n && lendGivenBondParams.assetIn + state.x < MAXUINT112)
  ) {
    return { data: params, error: '' }
  }
  const delState = { x: lendGivenBondParams.assetIn, y: yDecreaseLendGivenBond, z: zDecreaseLendGivenBond }
  if (!LendMath.check(state, delState)) {
    return { data: params, error: LendMath.checkError(state, delState) }
  }
  if (LendMath.getInsurance(state, delState, maturity, currentTimeLGB) < lendGivenBondParams.minInsurance) {
    return { data: params, error: 'E515' }
  }
  return { data: params, error: '' }
}

export function lendGivenInsuranceSuccess(
  params: { newLiquidityParams: NewLiquidityParams; lendGivenInsuranceParams: LendGivenInsuranceParams },
  currentTimeNL: bigint,
  currentTimeLGI: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, lendGivenInsuranceParams } = params
  if (lendGivenInsuranceParams.assetIn <= 0 || lendGivenInsuranceParams.insuranceOut <= 0) {
    return false
  }
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTimeNL,
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
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  if (
    !LendMath.verifyYAndZDecreaseLendGivenInsurance(
      state,
      maturity,
      currentTimeLGI,
      lendGivenInsuranceParams.assetIn,
      lendGivenInsuranceParams.insuranceOut
    )
  ) {
    return false
  }
  const { yDecreaseLendGivenInsurance, zDecreaseLendGivenInsurance } = LendMath.calcYAndZDecreaseLendGivenInsurance(
    state,
    maturity,
    currentTimeLGI,
    lendGivenInsuranceParams.assetIn,
    lendGivenInsuranceParams.insuranceOut
  )
  if (
    !(
      yDecreaseLendGivenInsurance >= 0n &&
      zDecreaseLendGivenInsurance >= 0n &&
      lendGivenInsuranceParams.assetIn + state.x < MAXUINT112 &&
      state.y - yDecreaseLendGivenInsurance >= 0n &&
      state.z - zDecreaseLendGivenInsurance >= 0n
    )
  ) {
    return false
  }
  const delState = {
    x: lendGivenInsuranceParams.assetIn,
    y: yDecreaseLendGivenInsurance,
    z: zDecreaseLendGivenInsurance,
  }
  if (!LendMath.check(state, delState)) {
    return false
  }
  if (LendMath.getBond(delState, maturity, currentTimeLGI) < lendGivenInsuranceParams.minBond) {
    return false
  }
  return true
}

export function lendGivenInsuranceError(
  params: { newLiquidityParams: NewLiquidityParams; lendGivenInsuranceParams: LendGivenInsuranceParams },
  currentTimeNL: bigint,
  currentTimeLGI: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, lendGivenInsuranceParams } = params
  if (lendGivenInsuranceParams.assetIn <= 0) {
    return { data: params, error: 'E205' }
  }
  if (lendGivenInsuranceParams.insuranceOut <= 0) {
    return { data: params, error: '' }
  }
  const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
    newLiquidityParams.assetIn,
    newLiquidityParams.debtIn,
    newLiquidityParams.collateralIn,
    currentTimeNL,
    maturity
  )
  if (!(yIncreaseNewLiquidity < MAXUINT112 && zIncreaseNewLiquidity < MAXUINT112)) {
    return { data: params, error: '' }
  }

  if (!(yIncreaseNewLiquidity > 0n && zIncreaseNewLiquidity > 0n)) {
    return { data: params, error: '' }
  }
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  if (
    !LendMath.verifyYAndZDecreaseLendGivenInsurance(
      state,
      maturity,
      currentTimeLGI,
      lendGivenInsuranceParams.assetIn,
      lendGivenInsuranceParams.insuranceOut
    )
  ) {
  
    return { data: params, error: '' }
  }
  const { yDecreaseLendGivenInsurance, zDecreaseLendGivenInsurance } = LendMath.calcYAndZDecreaseLendGivenInsurance(
    state,
    maturity,
    currentTimeLGI,
    lendGivenInsuranceParams.assetIn,
    lendGivenInsuranceParams.insuranceOut
  )
  if (
    !(
      yDecreaseLendGivenInsurance >= 0n &&
      zDecreaseLendGivenInsurance >= 0n &&
      lendGivenInsuranceParams.assetIn + state.x < MAXUINT112 &&
      state.y - yDecreaseLendGivenInsurance >= 0n &&
      state.z - zDecreaseLendGivenInsurance >= 0n
    )
  ) {
    return { data: params, error: '' }
  }
  const delState = {
    x: lendGivenInsuranceParams.assetIn,
    y: yDecreaseLendGivenInsurance,
    z: zDecreaseLendGivenInsurance,
  }
  if (!LendMath.check(state, delState)) {
    return { data: params, error: LendMath.checkError(state, delState) }
  }
  if (LendMath.getBond(delState, maturity, currentTimeLGI) < lendGivenInsuranceParams.minBond) {
    return { data: params, error: 'E514' }
  }
  return { data: params, error: '' }
}

export function lendGivenPercentSuccess(
  params: { newLiquidityParams: NewLiquidityParams; lendGivenPercentParams: LendGivenPercentParams },
  currentTimeNL: bigint,
  currentTimeLGP: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, lendGivenPercentParams } = params
  if (
    lendGivenPercentParams.assetIn <= 0 ||
    lendGivenPercentParams.percent < 0 ||
    lendGivenPercentParams.minBond <= 0 ||
    lendGivenPercentParams.minInsurance <= 0
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
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  if (
    !LendMath.verifyYAndZDecreaseLendGivenPercent(
      state,
      maturity,
      currentTimeLGP,
      lendGivenPercentParams.assetIn,
      lendGivenPercentParams.percent
    )
  )
    return false
  const { yDecreaseLendGivenPercent, zDecreaseLendGivenPercent } = LendMath.calcYAndZDecreaseLendGivenPercent(
    state,
    maturity,
    currentTimeLGP,
    lendGivenPercentParams.assetIn,
    lendGivenPercentParams.percent
  )
  if (
    !(
      yDecreaseLendGivenPercent > 0n &&
      zDecreaseLendGivenPercent > 0n &&
      lendGivenPercentParams.assetIn + state.x < MAXUINT112 &&
      state.y - yDecreaseLendGivenPercent > 0n &&
      state.z - zDecreaseLendGivenPercent > 0n
    )
  ) {
    return false
  }
  const delState = { x: lendGivenPercentParams.assetIn, y: yDecreaseLendGivenPercent, z: zDecreaseLendGivenPercent }
  if (!LendMath.check(state, delState)) {
    return false
  }
  if (LendMath.getBond(delState, maturity, currentTimeLGP) < lendGivenPercentParams.minBond) {
    return false
  }
  if (LendMath.getInsurance(state, delState, maturity, currentTimeLGP) < lendGivenPercentParams.minInsurance) {
    return false
  }
  return true
}
export function collectSuccess(
  params: {
    newLiquidityParams: NewLiquidityParams
    lendGivenBondParams: LendGivenBondParams
    collectParams: CollectParams
  },
  currentTimeNL: bigint,
  currentTimeLGB: bigint,
  maturity: bigint
) {
  const { newLiquidityParams, lendGivenBondParams, collectParams } = params
  if (
    lendGivenBondParams.assetIn <= 0 ||
    lendGivenBondParams.bondOut <= 0 ||
    lendGivenBondParams.minInsurance <= 0 ||
    lendGivenBondParams.bondOut - lendGivenBondParams.assetIn <= 0
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
  const state = { x: newLiquidityParams.assetIn, y: yIncreaseNewLiquidity, z: zIncreaseNewLiquidity }
  if (
    !LendMath.verifyYAndZDecreaseLendGivenBond(
      state,
      maturity,
      currentTimeLGB,
      lendGivenBondParams.assetIn,
      lendGivenBondParams.bondOut
    )
  ) {
    return false
  }
  const { yDecreaseLendGivenBond, zDecreaseLendGivenBond } = LendMath.calcYAndZDecreaseLendGivenBond(
    state,
    maturity,
    currentTimeLGB,
    lendGivenBondParams.assetIn,
    lendGivenBondParams.bondOut
  )
  if (
    !(yDecreaseLendGivenBond > 0n && zDecreaseLendGivenBond > 0n && lendGivenBondParams.assetIn + state.x < MAXUINT112)
  ) {
    return false
  }
  const delState = { x: lendGivenBondParams.assetIn, y: yDecreaseLendGivenBond, z: zDecreaseLendGivenBond }
  if (!LendMath.check(state, delState)) {
    return false
  }
  if (LendMath.getInsurance(state, delState, maturity, currentTimeLGB) < lendGivenBondParams.minInsurance) {
    return false
  }
  const bond = LendMath.getBond(delState, maturity, currentTimeLGB)
  const insurance = LendMath.getInsurance(state, delState, maturity, currentTimeLGB)
  if (collectParams.claims.bond > bond || collectParams.claims.insurance > insurance) return false
  return true
}
