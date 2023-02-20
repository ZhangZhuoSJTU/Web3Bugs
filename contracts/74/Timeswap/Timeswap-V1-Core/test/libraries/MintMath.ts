import { mulDiv } from '../libraries/FullMath'
import { State } from '../shared/PairInterface'
import { divUp, shiftRightUp } from './Math'

export function getLiquidityTotal1(assetIn: bigint): bigint {
  let liquidityTotal = assetIn
  liquidityTotal <<= 16n
  return liquidityTotal
}

export function getLiquidityTotal2(
  state: State,
  assetIn: bigint,
  interestIncrease: bigint,
  cdpIncrease: bigint
): bigint {
  const liquidityTotal = min(
    mulDiv(state.totalLiquidity, assetIn, state.asset),
    mulDiv(state.totalLiquidity, interestIncrease, state.interest),
    mulDiv(state.totalLiquidity, cdpIncrease, state.cdp)
  )
  return liquidityTotal
}

export function getLiquidity(maturity: bigint, liquidityTotal: bigint, protocolFee: bigint, now: bigint): bigint {
  let denominator = maturity
  denominator -= now
  denominator *= BigInt(protocolFee)
  denominator += 0x10000000000n
  const liquidityOut = mulDiv(liquidityTotal, 0x10000000000n, denominator)
  return liquidityOut
}

export function min(w: bigint, x: bigint, y: bigint): bigint {
  if (w <= x && w <= y) {
    return w
  } else if (x <= w && x <= y) {
    return x
  } else {
    return y
  }
}

export function getDebt(maturity: bigint, assetIn: bigint, interestIncrease: bigint, now: bigint): bigint {
  let _debtOut = maturity
  _debtOut -= now
  _debtOut *= interestIncrease
  _debtOut = shiftRightUp(_debtOut, 32n)
  _debtOut += assetIn
  const debtOut = _debtOut
  return debtOut
}

export function getCollateral(
  maturity: bigint,
  assetIn: bigint,
  interestIncrease: bigint,
  cdpIncrease: bigint,
  now: bigint
): bigint {
  let _collateralIn = maturity
  _collateralIn -= now
  _collateralIn *= cdpIncrease
  _collateralIn = shiftRightUp(_collateralIn, 25n)
  _collateralIn += cdpIncrease
  return _collateralIn
}

export default {
  getLiquidityTotal1,
  getLiquidityTotal2,
  getLiquidity,
  getDebt,
  getCollateral,
}
