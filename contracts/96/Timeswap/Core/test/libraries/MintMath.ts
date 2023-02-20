import { mulDiv, mulDivUp } from '../libraries/FullMath'
import { State } from '../shared/PairInterface'
import { divUp, shiftRightUp } from './Math'
import { now as blockTimestamp } from '../shared/Helper';
export interface Tokens {
  asset: bigint
  collateral: bigint
}
export interface TotalClaims {
  bondPrincipal: bigint
  bondInterest: bigint
  insurancePrincipal: bigint
  insuranceInterest: bigint
}
export interface Claims {
  lender: string
  claims: TotalClaims
}
interface StateParams {
  reserves: Tokens
  totalLiquidity: bigint
  totalClaims: Claims
  totalDebtCreated: bigint
  x: bigint
  y: bigint
  z: bigint
  feeStored: bigint
}

export function getLiquidity1(assetIn: bigint): bigint {
  let liquidityTotal = assetIn
  liquidityTotal <<= 16n
  return liquidityTotal
}

export function getLiquidity2(
  state: State,
  assetIn: bigint,
  interestIncrease: bigint,
  cdpIncrease: bigint
): bigint | string{
  const fromX = mulDiv(state.totalLiquidity,assetIn,state.asset)
  const fromY = mulDiv(state.totalLiquidity,interestIncrease,state.interest)
  const fromZ = mulDiv(state.totalLiquidity,cdpIncrease,state.cdp)

  if(fromY> fromX) return 'E214'
  if(fromZ>fromX) return 'E215'

  return (fromY <= fromZ ? fromY : fromZ)
}



export function getFee(
  state: State,
  liquidityOut: bigint
){
  return (state.totalLiquidity == 0n ? 0n : mulDivUp(state.feeStored,liquidityOut,state.totalLiquidity))
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
  getLiquidity1,
  getLiquidity2,
  getDebt,
  getCollateral,
  getFee
}
