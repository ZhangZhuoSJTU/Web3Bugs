export interface LendGivenBondParams {
  assetIn: bigint
  bondOut: bigint
  minInsurance: bigint
}
export interface LendGivenInsuranceParams {
  assetIn: bigint
  insuranceOut: bigint
  minBond: bigint
}
export interface LendGivenPercentParams {
  assetIn: bigint
  percent: bigint
  minInsurance: bigint
  minBond: bigint
}
