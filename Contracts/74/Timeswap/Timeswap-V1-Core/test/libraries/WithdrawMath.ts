import { State } from '../shared/PairInterface'

export function getAsset(state: State, bondIn: bigint): bigint {
  if (state.reserves.asset >= state.totalClaims.bond) return bondIn
  let _assetOut = bondIn
  _assetOut *= state.reserves.asset
  _assetOut /= state.totalClaims.bond
  return _assetOut
}

export function getCollateral(state: State, insuranceIn: bigint): bigint {
  if (state.reserves.asset >= state.totalClaims.bond) return 0n
  let deficit = state.totalClaims.bond
  deficit -= state.reserves.asset
  if (state.reserves.collateral * state.totalClaims.bond >= deficit * state.totalClaims.insurance) {
    let _collateralOut = deficit
    _collateralOut *= insuranceIn
    _collateralOut /= state.totalClaims.bond
    return _collateralOut
  } else {
    let _collateralOut = state.reserves.collateral
    _collateralOut *= insuranceIn
    _collateralOut /= state.totalClaims.insurance
    return _collateralOut
  }
}

export default {
  getAsset,
  getCollateral,
}
