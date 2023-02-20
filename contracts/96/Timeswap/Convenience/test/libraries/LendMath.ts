import { getMaxListeners } from 'process'
import { bigInt } from '../../node_modules/fast-check/lib/types/fast-check-default'
import { divUp, mulDiv, mulDivUp, sqrtUp } from '../shared/Helper'

const MAXUINT112: bigint = 2n ** 112n
const MAXUINT256 = 1n << 256n


export const getLendGivenBondParams = (
  state: { x: bigint; y: bigint; z: bigint },
  fee:bigint,
  protocolFee: bigint,
  maturity: bigint,
  currentTime: bigint,
  assetIn: bigint,
  bondOut: bigint
) => {
  const xIncrease = getX(protocolFee, fee,maturity,currentTime, assetIn);

  let xReserve = state.x;
  xReserve += xIncrease;

  let _yDecrease = bondOut;
  _yDecrease -= xIncrease;
  _yDecrease <<= 32n;
  let denominator = maturity;
  denominator -= currentTime;
  _yDecrease = divUp(_yDecrease,denominator);

  let yReserve = state.y;
  yReserve -= _yDecrease;

  let zReserve = state.x;
  zReserve *= state.y;
  denominator = xReserve;
  denominator *= yReserve;
  zReserve = mulDivUp(zReserve,state.z, denominator);

  let _zDecrease = state.z;
  _zDecrease -= zReserve;
  return {xIncrease: xIncrease, yDecrease: _yDecrease,zDecrease: _zDecrease}
}
export const getLendGivenInsuranceParams = (
  state: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  fee:bigint,
  protocolFee: bigint,
  currentTime: bigint,
  assetIn: bigint,
  insuranceOut: bigint
) => {

  let xIncrease = getX(protocolFee, fee,maturity,currentTime, assetIn);

  let xReserve = state.x;
  xReserve += xIncrease;

  let _zDecrease = insuranceOut;
  _zDecrease *= xReserve;
  let subtrahend = state.z;
  subtrahend *= xIncrease;
  _zDecrease -= subtrahend;
  _zDecrease <<= 25n;
  let denominator = maturity-currentTime
  denominator *= xReserve;
  _zDecrease = divUp(_zDecrease,denominator);

  let zReserve = state.z;
  zReserve -= _zDecrease;

  let yReserve = state.x;
  yReserve *= state.z;
  denominator = xReserve;
  denominator *= zReserve;
  yReserve = mulDivUp(yReserve,state.y, denominator);

  let _yDecrease = state.y;
  _yDecrease -= yReserve;
  return { xIncrease: xIncrease,yDecrease: _yDecrease, zDecrease: _zDecrease }
}
export const getLendGivenPercentParams = (
  state: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  currentTime: bigint,
  fee:bigint,
  protocolFee:bigint,
  assetIn: bigint,
  percent: bigint
) => {
  let xIncrease = getX(fee, protocolFee,maturity,currentTime, assetIn);

        let xReserve = state.x;
        xReserve += xIncrease;

        if (percent <= 0x80000000) {
            let yMid = state.y;
            let subtrahend = state.y;
            subtrahend *= state.y;
            subtrahend = mulDivUp(subtrahend,state.x, xReserve);
            subtrahend = sqrtUp(subtrahend);
            yMid -= subtrahend;

            let _yDecrease = yMid;
            _yDecrease *= percent;
            _yDecrease >>= 31n;

            let yReserve = state.y;
            yReserve -= _yDecrease;

            let zReserve = state.x;
            zReserve *= state.y;
            let denominator = xReserve;
            denominator *= yReserve;
            zReserve = mulDivUp(zReserve,state.z, denominator);

            let _zDecrease = state.z;
            _zDecrease -= zReserve;

            return { xIncrease: xIncrease,yDecrease: _yDecrease, zDecrease: _zDecrease }

        } else {
            percent = 0x100000000n - percent;

            let zMid = state.z;
            let subtrahend = state.z;
            subtrahend *= state.z;
            subtrahend = mulDivUp(subtrahend,state.z, xReserve);
            subtrahend = sqrtUp(subtrahend);
            zMid -= subtrahend;

            let _zDecrease = zMid;
            _zDecrease *= percent;
            _zDecrease >>= 31n;

            let zReserve = state.z;
            zReserve -= _zDecrease;

            let yReserve = state.x;
            yReserve *= state.z;
            let denominator = xReserve;
            denominator *= zReserve;
            yReserve = mulDivUp(yReserve,state.y, denominator);

            let _yDecrease = state.y;
            _yDecrease -= yReserve;
            
            return { xIncrease: xIncrease,yDecrease: _yDecrease, zDecrease: _zDecrease }


        }


}
const adjust = (reserve: bigint, decrease: bigint, feeBase: bigint) => {
  return (reserve << 16n) - feeBase * decrease
}

const checkConstantProduct = (
  state: {
    x: bigint
    y: bigint
    z: bigint
  },
  adjDelState: {
    x: bigint
    y: bigint
    z: bigint
  }
) => {
  if (adjDelState.y * adjDelState.z * adjDelState.x > state.y * (state.z << 32n) * state.x) {
    return true
  }
  return false
}

export const check = (
  state: {
    x: bigint
    y: bigint
    z: bigint
  },
  delState: {
    x: bigint
    y: bigint
    z: bigint
  }
) => {
  const feeBase = BigInt(0x10000 + 100)
  const xReserve = delState.x + state.x
  const yAdjusted = adjust(state.y, delState.y, feeBase)
  const zAdjusted = adjust(state.z, delState.z, feeBase)
  if (checkConstantProduct(state, { x: xReserve, y: yAdjusted, z: zAdjusted })) {
    const minimum = ((delState.x * state.y) << 12n) / (xReserve * feeBase)
    if (delState.y < minimum) {
      return false
    } else {
      return true
    }
  } else {
    return false
  }
}

export const checkError = (
  state: {
    x: bigint
    y: bigint
    z: bigint
  },
  delState: {
    x: bigint
    y: bigint
    z: bigint
  }
) => {
  const feeBase = BigInt(0x10000 + 100)
  const xReserve = delState.x + state.x
  const yAdjusted = adjust(state.y, delState.y, feeBase)
  const zAdjusted = adjust(state.z, delState.z, feeBase)
  if (checkConstantProduct(state, { x: xReserve, y: yAdjusted, z: zAdjusted })) {
    const minimum = ((delState.x * state.y) << 12n) / (xReserve * feeBase)
    if (delState.y < minimum) {
      return 'Minimum'
    } else {
      return ''
    }
  } else {
    return 'Invariance'
  }
}

export const getBond = (delState: { x: bigint; y: bigint; z: bigint }, maturity: bigint, currentTime: bigint) => {
  return (((maturity - currentTime) * delState.y) >> 32n) + delState.x
}
export const getInsurance = (
  state: { x: bigint; y: bigint; z: bigint },
  delState: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  currentTime: bigint
) => {
  const addend = (state.z * delState.x) << 32n
  const _insuranceOut = ((maturity - currentTime) * delState.z)>>25n
  const denominator = (delState.x + state.x) 
  const minimum = (state.z*delState.x)/denominator
  return (_insuranceOut + minimum)
}

export const getX=(protocolFee:bigint, fee:bigint,maturity:bigint,currentTime:bigint,assetIn: bigint)=>{
const duration = maturity - currentTime

const BASE = 0x10000000000n
let denominator = (duration * fee ) + BASE

let xIncrease = assetIn*BASE/denominator

denominator = (duration * protocolFee )+BASE

xIncrease *= BASE
xIncrease/=denominator
return xIncrease
}