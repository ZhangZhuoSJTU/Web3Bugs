export function checkConstantProduct(
  state: {
    asset: bigint
    interest: bigint
    cdp: bigint
  },
  assetReserve: bigint,
  interestAdjusted: bigint,
  cdpAdjusted: bigint
): boolean {
  const currentProduct = ((state.interest * state.cdp) << 32n) * state.asset
  const newProduct = interestAdjusted * cdpAdjusted * assetReserve
  if (newProduct >= currentProduct) return true
  return false
}
export default {
  checkConstantProduct,
}
