export interface AddLiquidityGivenAssetParams {
  assetIn: bigint
  minLiquidity: bigint
  maxDebt: bigint
  maxCollateral: bigint
}

export interface LiquidityGivenDebtParams {
  debtIn: bigint
  minLiquidity: bigint
  maxAsset: bigint
  maxCollateral: bigint
}

export interface LiquidityGivenCollateralParams {
  collateralIn: bigint
  minLiquidity: bigint
  maxDebt: bigint
  maxAsset: bigint
}

export interface NewLiquidityParams {
  assetIn: bigint
  debtIn: bigint
  collateralIn: bigint
}

export interface RemoveLiquidityParams {
  liquidityIn: bigint
}


export interface LiquidityGivenDebtParams {
  debtIn: bigint;
  minLiquidity: bigint;
  maxAsset: bigint;
  maxCollateral:bigint;
}


export interface LiquidityGivenCollateralParams {
  collateralIn: bigint;
  minLiquidity: bigint;
  maxAsset: bigint;
  maxDebt: bigint;
}
