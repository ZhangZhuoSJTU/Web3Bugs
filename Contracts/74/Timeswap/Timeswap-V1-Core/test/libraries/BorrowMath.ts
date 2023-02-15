import { doesNotMatch } from 'assert'
import { checkConstantProduct } from '../libraries/ConstantProduct'
import { divUp, shiftRightUp } from '../libraries/Math'

export function check(
  state: {
    asset: bigint
    interest: bigint
    cdp: bigint
  },
  assetOut: bigint,
  interestIncrease: bigint,
  cdpIncrease: bigint,
  fee: bigint
): boolean | string {
  const feeBase = 0x10000n - fee
  const assetReserve = state.asset - assetOut
  if (assetReserve < 0) return 'assetReserve < 0'
  const interestAdjusted = adjust(interestIncrease, state.interest, feeBase)
  const cdpAdjusted = adjust(cdpIncrease, state.cdp, feeBase)
  const productCheck = checkConstantProduct(state, assetReserve, interestAdjusted, cdpAdjusted)
  if (!productCheck) return 'Invariance'
  let minimum = assetOut
  minimum *= state.interest
  minimum = minimum << 12n
  let denominator = state.asset
  denominator *= feeBase
  minimum = divUp(minimum, denominator)
  if (interestIncrease < minimum) return 'interestIncrease < minimum'
  return true
}

export function adjust(increase: bigint, reserve: bigint, feeBase: bigint): bigint {
  let adjusted = reserve
  adjusted <<= 16n
  adjusted += feeBase * increase
  return adjusted
}

export function readjust(adjusted: bigint, reserve: bigint, feeBase: bigint): bigint {
  let increase = adjusted
  increase -= reserve << 16n
  increase = divUp(increase, feeBase)
  return increase
}

export function getDebt(maturity: bigint, assetOut: bigint, interestIncrease: bigint, now: bigint): bigint {
  let _debtOut = maturity
  _debtOut -= now
  _debtOut *= interestIncrease
  _debtOut = shiftRightUp(_debtOut, 32n)
  _debtOut += assetOut
  return _debtOut
}

export function getCollateral(
  maturity: bigint,
  state: {
    asset: bigint
    interest: bigint
    cdp: bigint
  },
  assetOut: bigint,
  cdpIncrease: bigint,
  now: bigint
): bigint {
  let _collateralIn = maturity
  _collateralIn -= now
  _collateralIn *= cdpIncrease
  _collateralIn = shiftRightUp(_collateralIn, 25n)
  let minimum = state.cdp
  minimum *= assetOut
  let denominator = state.asset
  denominator -= assetOut
  minimum = divUp(minimum, denominator)
  _collateralIn += minimum
  return _collateralIn
}

export default {
  check,
  adjust,
  readjust,
  getDebt,
  getCollateral,
}
