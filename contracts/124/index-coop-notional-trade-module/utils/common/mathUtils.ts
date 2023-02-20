import { BigNumber } from "ethers";

import { PRECISE_UNIT, ZERO } from "../constants";

export const preciseMul = (a: BigNumber, b: BigNumber): BigNumber => {
  return a.mul(b).div(PRECISE_UNIT);
};

export const preciseMulCeil = (a: BigNumber, b: BigNumber): BigNumber => {
  if (a.eq(0) || b.eq(0)) {
    return ZERO;
  }

  return a.mul(b).sub(1).div(PRECISE_UNIT).add(1);
};

export const preciseMulCeilInt = (a: BigNumber, b: BigNumber): BigNumber => {
  if (a.eq(0) || b.eq(0)) {
    return ZERO;
  }

  if (a.gt(0) && b.gt(0) || a.lt(0) && b.lt(0)) {
    return a.mul(b).sub(1).div(PRECISE_UNIT).add(1);
  } else {
    return a.mul(b).add(1).div(PRECISE_UNIT).sub(1);
  }
};

export const preciseDiv = (a: BigNumber, b: BigNumber): BigNumber => {
  return a.mul(PRECISE_UNIT).div(b);
};

export const preciseDivCeil = (a: BigNumber, b: BigNumber): BigNumber => {
  if (a.eq(0) || b.eq(0)) {
    return ZERO;
  }

  return a.mul(PRECISE_UNIT).sub(1).div(b).add(1);
};

export const preciseDivCeilInt = (a: BigNumber, b: BigNumber): BigNumber => {
  const result = a.mul(PRECISE_UNIT).div(b);
  if (result.mul(b).eq(a.mul(PRECISE_UNIT))) {
    return result;
  }

  if ((a.gt(0) && b.gt(0)) || (a.lt(0) && b.lt(0))) {
    return result.add(1);
  } else {
    return result.sub(1);
  }
};

export const divDown = (a: BigNumber, b: BigNumber): BigNumber => {
  let result = a.div(b);
  if (a.lt(0) && b.gt(0) && !a.mod(b).isZero()) {
    result = result.sub(1);
  } else if (a.gt(0) && b.lt(0) && !a.mod(b.mul(-1)).isZero()) {
    result = result.sub(1);
  }
  return result;
};

export const min = (
  valueOne: BigNumber,
  valueTwo: BigNumber
): BigNumber => {
  return valueOne.lt(valueTwo) ? valueOne : valueTwo;
};
