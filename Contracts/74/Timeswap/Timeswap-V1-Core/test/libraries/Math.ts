export function divUp(x: bigint, y: bigint): bigint {
  let z = x / y
  if (x % y > 0) z++
  return z
}

export function shiftRightUp(x: bigint, y: bigint): bigint {
  let z = x >> y
  if (x != z << y) z++
  return z
}

export default {
  divUp,
  shiftRightUp,
}
