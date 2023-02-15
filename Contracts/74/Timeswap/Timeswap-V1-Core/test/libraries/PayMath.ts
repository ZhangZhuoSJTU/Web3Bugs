import { Due } from '../shared/PairInterface'

export function checkProportional(assetIn: bigint, collateralOut: bigint, due: Due) {
  if (assetIn * due.collateral >= collateralOut * due.debt) {
    return true
  } else return false
}
export function getDebt(_debtIn: bigint, debt: bigint): bigint {
  if (_debtIn >= debt) return debt
  return _debtIn
}

export function getCollateral(_collateralOut: bigint, debtIn: bigint, collateral: bigint, debt: bigint): bigint | null {
  if (debtIn * collateral < _collateralOut * debt) return null
  if (_collateralOut >= collateral) return collateral
  let collateralOut = _collateralOut
  return collateralOut
}

export default { getDebt, getCollateral, checkProportional }
