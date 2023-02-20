import { bigInt } from '../../node_modules/fast-check/lib/types/fast-check-default'
import { divUp, mulDiv, mulDivUp, sqrtUp } from '../shared/Helper'

const MAXUINT112: bigint = 2n ** 112n
const MAXUINT256 = 1n << 256n

export const verifyYAndZDecreaseLendGivenBond = (
  state: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  currentTime: bigint,
  assetIn: bigint,
  bondOut: bigint
) => {
  const feeBase = BigInt(0x10000 + 100)
  const yDecrease = divUp((bondOut - assetIn) << 32n, maturity - currentTime)
  if (yDecrease <= 0 || yDecrease >= MAXUINT112) {
    return false
  }
  const yAdjust = (state.y << 16n) - yDecrease * feeBase
  if (yAdjust <= 0 || yAdjust >= MAXUINT112) {
    return false
  }
  const xAdjust = state.x + assetIn
  if (xAdjust <= 0 || xAdjust >= MAXUINT112) {
    return false
  }
  const zDecrease = mulDiv(
    xAdjust * yAdjust - ((state.x * state.y) << 16n),
    state.z << 16n,
    xAdjust * yAdjust * feeBase
  )
  if (zDecrease <= 0 || zDecrease >= MAXUINT112) {
    return false
  }
  return true
}
export const verifyYAndZDecreaseLendGivenInsurance = (
  state: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  currentTime: bigint,
  assetIn: bigint,
  insuranceOut: bigint
) => {
  const feeBase = 0x10000n + 100n
  const xAdjust = state.x + assetIn
  if (xAdjust < 0 || xAdjust >= MAXUINT256) {
    return false
  }

  if (
    (insuranceOut * xAdjust - state.z * assetIn) << 25n >= MAXUINT256 ||
    (maturity - currentTime) * state.y >= MAXUINT256 ||
    (insuranceOut * xAdjust - state.z * assetIn) << 25n <= 0
  ) {
    return false
  }

  if (divUp((insuranceOut * xAdjust - state.z * assetIn) << 25n, (maturity - currentTime) * xAdjust) >= MAXUINT256) {
    return false
  }
  const zDecrease = divUp((insuranceOut * xAdjust - state.z * assetIn) << 32n, (maturity - currentTime) * xAdjust)

  if (zDecrease < 0 || zDecrease >= MAXUINT112) {
    return false
  }
  const zAdjust = (state.z << 16n) - zDecrease * feeBase
  if (zAdjust <= 0 || zAdjust >= MAXUINT256) {
    return false
  }
  if (
    xAdjust * zAdjust - ((state.x * state.z) << 16n) >= MAXUINT256 ||
    state.y << 16n >= MAXUINT256 ||
    xAdjust * zAdjust * feeBase >= MAXUINT256
  ) {
    return false
  }

  if (
    mulDiv(xAdjust * zAdjust - ((state.x * state.z) << 16n), state.y << 16n, xAdjust * zAdjust * feeBase) >= MAXUINT256
  ) {
    return false
  }
  const yDecrease = mulDiv(
    xAdjust * zAdjust - ((state.x * state.z) << 16n),
    state.y << 16n,
    xAdjust * zAdjust * feeBase
  )
  if (yDecrease < 0 || yDecrease >= MAXUINT112) {
    return false
  }
  return { yDecreaseLendGivenInsurance: yDecrease, zDecreaseLendGivenInsurance: zDecrease }
}
export const verifyYAndZDecreaseLendGivenPercent = (
  state: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  currentTime: bigint,
  assetIn: bigint,
  percent: bigint
) => {
  const feeBase = BigInt(0x10000 + 100)
  const xAdjust = state.x + assetIn
  if (xAdjust < 0 || xAdjust >= MAXUINT256) {
    return false
  }

  if (percent <= 0x80000000n) {
    let yMid = (state.y << 16n) / feeBase
    const denominator = xAdjust * feeBase * feeBase
    const subtrahend = sqrtUp(mulDivUp((state.y * state.y) << 32n, state.x, denominator))
    yMid -= subtrahend

    if (
      yMid < 0 ||
      yMid >= MAXUINT256 ||
      denominator < 0 ||
      denominator >= MAXUINT256 ||
      subtrahend < 0 ||
      subtrahend >= MAXUINT256
    ) {
      return false
    }

    const yMin = ((assetIn * state.y) << 12n) / (xAdjust * feeBase)

    if (yMin < 0 || yMin >= MAXUINT256) {
      return false
    }

    const yDecrease = (((yMid - yMin) * percent) >> 31n) + yMin

    if (yDecrease < 0 || yDecrease >= MAXUINT112) {
      return false
    }

    const yAdjust = (state.y << 16n) - yDecrease * feeBase

    if (yAdjust <= 0 || yAdjust >= MAXUINT256) {
      return false
    }

    const zDecrease = mulDiv(
      xAdjust * yAdjust - ((state.x * state.y) << 16n),
      state.z << 16n,
      xAdjust * yAdjust * feeBase
    )

    if (zDecrease <= 0 || zDecrease >= MAXUINT112) {
      return false
    }
  } else {
    let zMid = (state.z << 16n) / feeBase
    const denominator = xAdjust * feeBase * feeBase
    const subtrahend = sqrtUp(mulDivUp((state.z * state.z) << 32n, state.x, denominator))
    zMid -= subtrahend

    if (
      zMid < 0 ||
      zMid >= MAXUINT256 ||
      denominator < 0 ||
      denominator >= MAXUINT256 ||
      subtrahend < 0 ||
      subtrahend >= MAXUINT256
    ) {
      return false
    }

    percent = 0x100000000n - percent

    const zDecrease = (zMid * percent) >> 31n

    if (zDecrease < 0 || zDecrease >= MAXUINT112) {
      return false
    }

    const zAdjust = (state.z << 16n) - zDecrease * feeBase

    if (zAdjust <= 0 || zAdjust >= MAXUINT256) {
      return false
    }

    const yDecrease = mulDiv(
      xAdjust * zAdjust - ((state.x * state.z) << 16n),
      state.y << 16n,
      xAdjust * zAdjust * feeBase
    )

    if (yDecrease < 0 || yDecrease >= MAXUINT112) {
      return false
    }
  }
  return true
}
export const calcYAndZDecreaseLendGivenBond = (
  state: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  currentTime: bigint,
  assetIn: bigint,
  bondOut: bigint
) => {
  const feeBase = 0x10000n + 100n
  const yDecrease = divUp((bondOut - assetIn) << 32n, maturity - currentTime)
  const yAdjust = (state.y << 16n) - yDecrease * feeBase
  const xAdjust = state.x + assetIn
  const zDecrease = mulDiv(
    xAdjust * yAdjust - ((state.x * state.y) << 16n),
    state.z << 16n,
    xAdjust * yAdjust * feeBase
  )

  return { yDecreaseLendGivenBond: yDecrease, zDecreaseLendGivenBond: zDecrease }
}

export const calcYAndZDecreaseLendGivenInsurance = (
  state: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  currentTime: bigint,
  assetIn: bigint,
  insuranceOut: bigint
) => {
  const feeBase = BigInt(0x10000 + 100)
  const xAdjust = state.x + assetIn
  const zDecrease = divUp((insuranceOut * xAdjust - state.z * assetIn) << 25n, (maturity - currentTime) * xAdjust)
  const zAdjust = (state.z << 16n) - zDecrease * feeBase
  const yDecrease = mulDiv(
    xAdjust * zAdjust - ((state.x * state.z) << 16n),
    state.y << 16n,
    xAdjust * zAdjust * feeBase
  )
  console.log({
    feeBase: feeBase,
    xAdjust: xAdjust,
    zDecrease: zDecrease,
    zAdjust: zAdjust,
    yDecrease: yDecrease,
  })
  return { yDecreaseLendGivenInsurance: yDecrease, zDecreaseLendGivenInsurance: zDecrease }
}
export const calcYAndZDecreaseLendGivenPercent = (
  state: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  currentTime: bigint,
  assetIn: bigint,
  percent: bigint
) => {
  const feeBase = BigInt(0x10000 + 100)
  const xAdjust = state.x + assetIn

  let yDecrease = 0n
  let zDecrease = 0n

  if (percent <= 0x80000000n) {
    let yMid = (state.y << 16n) / feeBase
    const denominator = xAdjust * feeBase * feeBase
    const subtrahend = sqrtUp(mulDivUp((state.y * state.y) << 32n, state.x, denominator))
    yMid -= subtrahend

    const yMin = ((assetIn * state.y) << 12n) / (xAdjust * feeBase)

    yDecrease = (((yMid - yMin) * percent) >> 31n) + yMin

    const yAdjust = (state.y << 16n) - yDecrease * feeBase

    zDecrease = mulDiv(xAdjust * yAdjust - ((state.x * state.y) << 16n), state.z << 16n, xAdjust * yAdjust * feeBase)
  } else {
    let zMid = (state.z << 16n) / feeBase
    const denominator = xAdjust * feeBase * feeBase
    const subtrahend = sqrtUp(mulDivUp((state.z * state.z) << 32n, state.x, denominator))
    zMid -= subtrahend

    percent = 0x100000000n - percent

    zDecrease = (zMid * percent) >> 31n

    const zAdjust = (state.z << 16n) - zDecrease * feeBase

    yDecrease = mulDiv(xAdjust * zAdjust - ((state.x * state.z) << 16n), state.y << 16n, xAdjust * zAdjust * feeBase)
  }

  return { yDecreaseLendGivenPercent: yDecrease, zDecreaseLendGivenPercent: zDecrease }
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
