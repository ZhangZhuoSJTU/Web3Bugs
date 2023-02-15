export const testcases = {
  newLiquidity: {
    assetIn: 1000000000n,
    debtIn: 2000000000n,
    collateralIn: 1000000000n,
  },
  borrow: Array(1000).fill({
    assetOut: 100n,
    debtIn: 150n,
    maxCollateral: 1000n,
  }),
}
