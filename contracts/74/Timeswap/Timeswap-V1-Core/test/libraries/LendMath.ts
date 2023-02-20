import { checkConstantProduct } from '../libraries/ConstantProduct'
import { shiftRightUp } from './Math'
import { min } from './MintMath'

export function check(
  state: {
    asset: bigint
    interest: bigint
    cdp: bigint
  },
  assetIn: bigint,
  interestDecrease: bigint,
  cdpDecrease: bigint,
  fee: bigint
): boolean {
  const feeBase = 0x10000n + fee
  const assetReserve = state.asset + assetIn
  const interestAdjusted = adjust(interestDecrease, state.interest, feeBase)
  const cdpAdjusted = adjust(cdpDecrease, state.cdp, feeBase)
  if (!checkConstantProduct(state, assetReserve, interestAdjusted, cdpAdjusted)) return false
  let minimum = assetIn
  minimum *= state.interest
  minimum = minimum << 12n
  let denominator = assetReserve
  denominator *= feeBase
  minimum /= denominator
  if (interestDecrease < minimum) return false
  return true
}
export function adjust(decrease: bigint, reserve: bigint, feeBase: bigint): bigint {
  let adjusted = reserve
  adjusted <<= 16n
  adjusted -= feeBase * decrease
  return adjusted
}
export function readjust(adjusted: bigint, reserve: bigint, feeBase: bigint): bigint {
  let decrease = reserve << 16n
  decrease -= adjusted
  decrease /= feeBase
  return decrease
}

export function getBond(maturity: bigint, assetIn: bigint, interestDecrease: bigint, now: bigint): bigint {
  let _bondOut = maturity
  _bondOut -= now
  _bondOut *= interestDecrease
  _bondOut >>= 32n
  _bondOut += assetIn
  return _bondOut
}

export function getInsurance(
  maturity: bigint,
  state: {
    asset: bigint
    interest: bigint
    cdp: bigint
  },
  assetIn: bigint,
  cdpDecrease: bigint,
  now: bigint
): bigint {
  let _insuranceOut = maturity
  _insuranceOut -= now
  _insuranceOut *= cdpDecrease
  _insuranceOut = _insuranceOut >> 25n //TODO: to confirm
  let minimum = state.cdp
  minimum *= assetIn
  let denominator = state.asset
  denominator += assetIn
  minimum /= denominator
  _insuranceOut += minimum
  return _insuranceOut
}

export default {
  check,
  adjust,
  readjust,
  getBond,
  getInsurance,
}
