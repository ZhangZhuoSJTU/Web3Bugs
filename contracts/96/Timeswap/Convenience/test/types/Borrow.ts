export interface BorrowGivenDebtParams {
  assetOut: bigint
  debtIn: bigint
  maxCollateral: bigint
}
export interface BorrowGivenCollateralParams {
  assetOut: bigint
  collateralIn: bigint
  maxDebt: bigint
}
export interface BorrowGivenPercentParams {
  assetOut: bigint
  percent: bigint
  maxDebt: bigint
  maxCollateral: bigint
}
