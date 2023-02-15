// NOTE: Does not include mul512

export function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  let z = a * b
  z = z / denominator
  return z
}

export function mulDivUp(a: bigint, b: bigint, denominator: bigint): bigint {
  let z = mulDiv(a, b, denominator)
  let mulmod = (a * b) % denominator
  if (mulmod > 0) z++
  return z
}

export default {
  mulDiv,
  mulDivUp,
}
