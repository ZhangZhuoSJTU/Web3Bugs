import { BigNumber } from 'ethers'
import { checkConstantProduct } from '../libraries/ConstantProduct'
import { mulDivUp } from './FullMath'
import { divUp } from './Math';

const MaxUint112 = BigNumber.from(2).pow(112).sub(1)

export function getFees(
  maturity:bigint,
  assetIn: bigint,
  fee:bigint,
  protocolFee: bigint,
  now: bigint
){
  let totalFee = fee;
  totalFee += protocolFee;

  let numerator = maturity;
  numerator -= now;
  numerator *= totalFee;
  numerator += 0x10000000000n;
  
  let adjusted = assetIn;
  adjusted *= numerator;
  adjusted = divUp(adjusted, 0x10000000000n);

  const totalFeeStoredIncrease = adjusted - assetIn

  let feeStoredIncrease = totalFeeStoredIncrease;
  feeStoredIncrease *= fee;
  feeStoredIncrease /= totalFee;
  let protocolFeeStoredIncrease = totalFeeStoredIncrease;
  protocolFeeStoredIncrease -= feeStoredIncrease;

  return {
    feeStoredIncrease: feeStoredIncrease,
    protocolFeeStoredIncrease: protocolFeeStoredIncrease
  }
}

export function check(
  state: {
    asset: bigint
    interest: bigint
    cdp: bigint
  },
  assetIn: bigint,
  interestDecrease: bigint,
  cdpDecrease: bigint,
): boolean|string {
  if (interestDecrease > state.interest) throw Error('interestDecrease > state.interest') 
  if (cdpDecrease > state.cdp) throw new Error('cdpDecrease > state.cdp')

  const xReserve = state.asset+ assetIn
  if (xReserve > BigInt(MaxUint112.toString())) throw new Error('xReserve > Uint112')
  
  const yReserve = state.interest - interestDecrease
  if (yReserve > BigInt(MaxUint112.toString())) throw new Error('yReserve > Uint112') 

  const zReserve = state.cdp - cdpDecrease
  if (zReserve > BigInt(MaxUint112.toString())) throw new Error('zReserve > Uint112') 

  if(!checkConstantProduct(state,xReserve,yReserve,zReserve)) throw 'Invariance'
  return true
}


export function getBondInterest(maturity: bigint, interestDecrease: bigint, now: bigint): bigint {
  let _bondInterestOut = maturity
  _bondInterestOut -= now
  _bondInterestOut *= interestDecrease
  _bondInterestOut >>= 32n
  if (_bondInterestOut > BigInt(MaxUint112.toString())) throw Error("bondInterestOut > Uint112")
  return _bondInterestOut
}

export function getInsurancePrincipal(
  state: {
    asset: bigint
    interest: bigint
    cdp: bigint
  },
  assetIn: bigint,
): bigint {
  let insurancePrincipalOut = state.cdp
  insurancePrincipalOut *= assetIn
  let denominator = state.asset
  denominator += assetIn
  insurancePrincipalOut /= denominator
  if (insurancePrincipalOut > BigInt(MaxUint112.toString())) throw Error("insurancePrincipalOut > Uint112")
  return insurancePrincipalOut
}

export function getInsuranceInterest(
  maturity: bigint,
  cdpDecrease: bigint,
  now: bigint
){
  let _insuranceInterestOut = maturity
  _insuranceInterestOut -= now
  _insuranceInterestOut *= cdpDecrease
  _insuranceInterestOut >>=25n
  if (_insuranceInterestOut > BigInt(MaxUint112.toString())) throw Error("insuranceInterestOut > Uint112")
  return _insuranceInterestOut
}


export default {
  check,
  getBondInterest,
  getInsuranceInterest,
  getInsurancePrincipal,
  getFees
}
