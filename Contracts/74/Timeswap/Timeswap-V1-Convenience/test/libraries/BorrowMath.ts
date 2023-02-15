import { FEE } from '../shared/Constants'
import { divUp, mulDivUp, shiftRightUp, sqrtUp } from '../shared/Helper'
const MAXUINT112 = 2 ** 112
const MAXUINT256 = 2 ** 256
const adjust = (reserve: bigint, increase: bigint) => {
  return (reserve << 16n) + (0x10000n - 100n) * increase
}
const constantProduct = (state: { x: bigint; y: bigint; z: bigint }, delState: { x: bigint; y: bigint; z: bigint }) => {
  if (delState.y * delState.z * delState.x > state.x * state.y * state.z) {
    return true
  }
  return false
}
export const check = (state: { x: bigint; y: bigint; z: bigint }, delState: { x: bigint; y: bigint; z: bigint }) => {
  const feeBase = 0x10000n - 100n
  const xReserve = state.x - delState.x
  const yAdjust = adjust(state.y, delState.y)
  const zAdjust = adjust(state.z, delState.z)
  if (!constantProduct(state, { x: xReserve, y: yAdjust, z: zAdjust })) {
    return false
  }
  const minimum = divUp((delState.x * state.y) << 12n, xReserve * feeBase)

  if (delState.y < minimum) {
    return false
  }

  return true
}
export const checkError = (
  state: { x: bigint; y: bigint; z: bigint },
  delState: { x: bigint; y: bigint; z: bigint }
) => {
  const feeBase = 0x10000n - 100n
  const xReserve = state.x - delState.x
  const yAdjust = adjust(state.y, delState.y)
  const zAdjust = adjust(state.z, delState.z)
  if (!constantProduct(state, { x: xReserve, y: yAdjust, z: zAdjust })) {
    return 'Invariance'
  }
  const minimum = divUp((delState.x * state.y) << 12n, xReserve * feeBase)
  if (delState.y < minimum) {
    return 'E302'
  }

  return ''
}
export const verifyYandZIncreaseBorrowGivenCollateral = (
  state: { x: bigint; y: bigint; z: bigint },
  assetOut: bigint,
  maturity: bigint,
  currentTime: bigint,
  collateralIn: bigint
) => {
  const feeBase = 0x10000n - 100n

  const xAdjust = state.x - assetOut
  if (xAdjust < 0 || xAdjust >= MAXUINT256) {
    return false
  }
  let _zIncrease = (collateralIn * xAdjust - state.z * assetOut) << 25n
  let denominator = (maturity - currentTime) * xAdjust
  const zIncrease = _zIncrease / denominator
  if (zIncrease <= 0 || zIncrease >= MAXUINT112) {
    return false
  }
  const zAdjust = (state.z << 16n) + zIncrease * feeBase
  if (zAdjust < 0 || zAdjust >= MAXUINT256) {
    return false
  }

  let subtrahend = xAdjust * zAdjust
  if (((state.x * state.z) << 16n) - subtrahend <= 0) {
    return false
  }
  denominator = xAdjust * zAdjust * feeBase
  const yIncrease = mulDivUp(((state.x * state.z) << 16n) - subtrahend, state.y << 16n, denominator)
  if (yIncrease <= 0 || yIncrease >= MAXUINT112) {
    return false
  }
  return { yIncreaseBorrowGivenCollateral: yIncrease, zIncreaseBorrowGivenCollateral: zIncrease }
}

export const getYandZIncreaseBorrowGivenPercent = (
  state: { x: bigint; y: bigint; z: bigint },
  assetOut: bigint,
  percent: bigint
) => {
  const feeBase = 0x10000n - 100n
  const xAdjust = state.x - assetOut

  let yIncrease = 0n
  let zIncrease = 0n

  if (percent <= 0x80000000n) {
    let yMid = (state.y * state.y) << 32n
    const denominator = xAdjust * feeBase * feeBase
    yMid = sqrtUp(mulDivUp(yMid, state.x, denominator))
    const subtrahend = (state.y << 16n) / feeBase
    yMid -= subtrahend

    const yMin = divUp((assetOut * state.y) << 12n, xAdjust * feeBase)

    yIncrease = shiftRightUp((yMid - yMin) * percent, 31n) + yMin

    const yAdjust = (state.y << 16n) + yIncrease * feeBase

    zIncrease = mulDivUp(((state.x * state.y) << 16n) - xAdjust * yAdjust, state.z << 16n, xAdjust * yAdjust * feeBase)
  } else {
    let zMid = (state.z * state.z) << 32n
    const denominator = xAdjust * feeBase * feeBase
    zMid = sqrtUp(mulDivUp(zMid, state.x, denominator))
    const subtrahend = (state.z << 16n) / feeBase
    zMid -= subtrahend

    percent = 0x100000000n - percent

    zIncrease = shiftRightUp(zMid * percent, 31n)

    const zAdjust = (state.z << 16n) + zIncrease * feeBase

    yIncrease = mulDivUp(((state.x * state.z) << 16n) - xAdjust * zAdjust, state.y << 16n, xAdjust * zAdjust * feeBase)
  }

  return { yIncreaseBorrowGivenPercent: yIncrease, zIncreaseBorrowGivenPercent: zIncrease }
}

export const getYandZIncreaseBorrowGivenCollateral = (
  state: { x: bigint; y: bigint; z: bigint },
  assetOut: bigint,
  maturity: bigint,
  currentTime: bigint,
  collateralIn: bigint
) => {
  const feeBase = 0x10000n - 100n

  const xAdjust = state.x - assetOut

  let _zIncrease = (collateralIn * xAdjust - state.z * assetOut) << 25n
  let denominator = (maturity - currentTime) * xAdjust
  const zIncrease = _zIncrease / denominator
  const zAdjust = (state.z << 16n) + zIncrease * feeBase

  let subtrahend = xAdjust * zAdjust
  denominator = xAdjust * zAdjust * feeBase
  const yIncrease = mulDivUp(((state.x * state.z) << 16n) - subtrahend, state.y << 16n, denominator)

  return { yIncreaseBorrowGivenCollateral: yIncrease, zIncreaseBorrowGivenCollateral: zIncrease }
}

export const getYandZIncreaseBorrowGivenDebt = (
  state: { x: bigint; y: bigint; z: bigint },
  assetOut: bigint,
  maturity: bigint,
  currentTime: bigint,
  debtIn: bigint
) => {
  const feeBase = 0x10000n - 100n

  const yIncrease = ((debtIn - assetOut) << 32n) / (maturity - currentTime)

  const yAdjust = (state.y << 16n) + yIncrease * feeBase
  const xAdjust = state.x - assetOut

  let denominator = xAdjust * yAdjust * feeBase
  const zIncrease = mulDivUp(((state.x * state.y) << 16n) - xAdjust * yAdjust, state.z << 16n, denominator)

  return { yIncreaseBorrowGivenDebt: yIncrease, zIncreaseBorrowGivenDebt: zIncrease }
}

export const getDebt = (delState: { x: bigint; y: bigint; z: bigint }, maturity: bigint, currentTime: bigint) => {
  return shiftRightUp((maturity - currentTime) * delState.y, 32n) + delState.x
}

export const getCollateral = (
  state: { x: bigint; y: bigint; z: bigint },
  delState: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  currentTime: bigint
) => {
  console.log('Ts', state.x, state.z, delState.x, delState.z)
  return shiftRightUp((maturity - currentTime) * delState.z, 25n) + divUp(state.z * delState.x, state.x - delState.x)
}
