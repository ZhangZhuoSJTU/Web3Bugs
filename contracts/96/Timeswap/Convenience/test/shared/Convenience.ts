import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Assertion } from 'chai'
import { run, ethers } from 'hardhat'
import { Test } from 'mocha'
import { PerformanceNodeTiming } from 'perf_hooks'
import { TestToken } from '../../typechain/TestToken'
import type { TimeswapConvenience as ConvenienceContract } from '../../typechain/TimeswapConvenience'
import type { TimeswapFactory as FactoryContract } from '../../typechain/TimeswapFactory'
import type { WETH9 as WethContract } from '../../typechain/WETH9'
import type { TimeswapPair as PairContract } from '../../typechain/TimeswapPair'
import { Claims, CollectParams } from '../types'
import { deploy } from './DeployConvenience'
interface Native {
  liquidity: string
  bondInterest: string
  bondPrincipal: string
  insuranceInterest: string
  insurancePrincipal: string
  collateralizedDebt: string
}
export class Convenience {
  public convenienceContract: ConvenienceContract
  public factoryContract: FactoryContract
  public wethContract: WethContract
  public signer: SignerWithAddress
  constructor(
    convenienceContract: ConvenienceContract,
    factoryContract: FactoryContract,
    wethContract: WethContract,
    signer: SignerWithAddress
  ) {
    this.convenienceContract = convenienceContract
    this.factoryContract = factoryContract
    this.wethContract = wethContract
    this.signer = signer
  }
  async updateSigner(signer: SignerWithAddress) {
    this.signer = signer
  }

  async getNatives(asset: string, collateral: string, maturity: bigint): Promise<Native> {
    return await this.convenienceContract.getNative(asset, collateral, maturity)
  }
  async newLiquidity(
    maturity: bigint,
    asset: string,
    collateral: string,
    assetIn: bigint,
    debtIn: bigint,
    collateralIn: bigint
  ) {
    return await this.convenienceContract.newLiquidity({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      assetIn: assetIn,
      debtIn: debtIn,
      collateralIn: collateralIn,
      dueTo: this.signer.address,
      liquidityTo: this.signer.address,
      deadline: maturity,
    })
  }
  async newLiquidityETHAsset(
    maturity: bigint,
    collateral: string,
    assetIn: bigint,
    debtIn: bigint,
    collateralIn: bigint
  ) {
    return await this.convenienceContract.newLiquidityETHAsset(
      {
        maturity: maturity,
        collateral: collateral,
        debtIn: debtIn,
        collateralIn: collateralIn,
        dueTo: this.signer.address,
        liquidityTo: this.signer.address,
        deadline: maturity,
      },
      { value: assetIn }
    )
  }
  async newLiquidityETHCollateral(
    maturity: bigint,
    asset: string,
    assetIn: bigint,
    debtIn: bigint,
    collateralIn: bigint
  ) {
    return await this.convenienceContract.newLiquidityETHCollateral(
      {
        maturity: maturity,
        asset: asset,
        assetIn: assetIn,
        debtIn: debtIn,
        dueTo: this.signer.address,
        liquidityTo: this.signer.address,
        deadline: maturity,
      },
      { value: collateralIn }
    )
  }
  async liquidityGivenAsset(
    maturity: bigint,
    asset: string,
    collateral: string,
    assetIn: bigint,
    minLiquidity: bigint,
    maxDebt: bigint,
    maxCollateral: bigint
  ) {
    return await this.convenienceContract.liquidityGivenAsset({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      assetIn: assetIn,
      minLiquidity: minLiquidity,
      maxDebt: maxDebt,
      maxCollateral: maxCollateral,
      dueTo: this.signer.address,
      liquidityTo: this.signer.address,
      deadline: maturity,
    })
  }
  async liquidityGivenAssetETHAsset(
    maturity: bigint,
    collateral: string,
    assetIn: bigint,
    minLiquidity: bigint,
    maxDebt: bigint,
    maxCollateral: bigint
  ) {
    return await this.convenienceContract.liquidityGivenAssetETHAsset(
      {
        maturity: maturity,
        collateral: collateral,
        minLiquidity: minLiquidity,
        maxDebt: maxDebt,
        maxCollateral: maxCollateral,
        dueTo: this.signer.address,
        liquidityTo: this.signer.address,
        deadline: maturity,
      },
      { value: assetIn }
    )
  }
  async liquidityGivenAssetETHCollateral(
    maturity: bigint,
    asset: string,
    assetIn: bigint,
    minLiquidity: bigint,
    maxDebt: bigint,
    maxCollateral: bigint
  ) {
    return await this.convenienceContract.liquidityGivenAssetETHCollateral(
      {
        maturity: maturity,
        asset: asset,
        assetIn: assetIn,
        minLiquidity: minLiquidity,
        maxDebt: maxDebt,
        dueTo: this.signer.address,
        liquidityTo: this.signer.address,
        deadline: maturity,
      },
      { value: maxCollateral }
    )
  }
  async liquidityGivenDebt(
    maturity: bigint,
    asset: string,
    collateral: string,
    debtIn: bigint,
    minLiquidity: bigint,
    maxAsset: bigint,
    maxCollateral: bigint
  ) {
    return await this.convenienceContract.liquidityGivenDebt({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      debtIn: debtIn,
      minLiquidity: minLiquidity,
      maxCollateral: maxCollateral,
      maxAsset: maxAsset,
      dueTo: this.signer.address,
      liquidityTo: this.signer.address,
      deadline: maturity,
    })
  }
  async liquidityGivenDebtETHAsset(
    maturity: bigint,
    collateral: string,
    debtIn: bigint,
    minLiquidity: bigint,
    maxAsset: bigint,
    maxCollateral: bigint
  ) {
    return await this.convenienceContract.liquidityGivenDebtETHAsset(
      {
        maturity: maturity,
        collateral: collateral,
        minLiquidity: minLiquidity,
        debtIn: debtIn,
        maxCollateral: maxCollateral,
        dueTo: this.signer.address,
        liquidityTo: this.signer.address,
        deadline: maturity,
      },
      { value: maxAsset }
    )
  }
  async liquidityGivenDebtETHCollateral(
    maturity: bigint,
    asset: string,
    debtIn: bigint,
    minLiquidity: bigint,
    maxAsset: bigint,
    maxCollateral: bigint
  ) {
    return await this.convenienceContract.liquidityGivenDebtETHCollateral(
      {
        maturity: maturity,
        asset: asset,
        debtIn: debtIn,
        minLiquidity: minLiquidity,
        maxAsset: maxAsset,
        dueTo: this.signer.address,
        liquidityTo: this.signer.address,
        deadline: maturity,
      },
      { value: maxCollateral }
    )
  }
  async liquidityGivenCollateral(
    maturity: bigint,
    asset: string,
    collateral: string,
    collateralIn: bigint,
    minLiquidity: bigint,
    maxDebt: bigint,
    maxAsset: bigint
  ) {
    return await this.convenienceContract.liquidityGivenCollateral({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      collateralIn: collateralIn,
      minLiquidity: minLiquidity,
      maxDebt: maxDebt,
      maxAsset: maxAsset,
      dueTo: this.signer.address,
      liquidityTo: this.signer.address,
      deadline: maturity,
    })
  }
  async liquidityGivenCollateralETHAsset(
    maturity: bigint,
    collateral: string,
    collateralIn: bigint,
    minLiquidity: bigint,
    maxDebt: bigint,
    maxAsset: bigint
  ) {
    return await this.convenienceContract.liquidityGivenCollateralETHAsset(
      {
        maturity: maturity,
        collateral: collateral,
        collateralIn: collateralIn,
        minLiquidity: minLiquidity,
        maxDebt: maxDebt,
        dueTo: this.signer.address,
        liquidityTo: this.signer.address,
        deadline: maturity,
      },
      { value:  maxAsset }
    )
  }
  async liquidityGivenCollateralETHCollateral(
    maturity: bigint,
    asset: string,
    collateralIn: bigint,
    minLiquidity: bigint,
    maxDebt: bigint,
    maxAsset: bigint
  ) {
    return await this.convenienceContract.liquidityGivenCollateralETHCollateral(
      {
        maturity: maturity,
        asset: asset,
        minLiquidity: minLiquidity,
        maxDebt: maxDebt,
        maxAsset: maxAsset,
        dueTo: this.signer.address,
        liquidityTo: this.signer.address,
        deadline: maturity,
      },
      { value: collateralIn }
    )
  }
  async removeLiquidity(maturity: bigint, asset: string, collateral: string, liquidityIn: bigint) {
    return await this.convenienceContract.removeLiquidity({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      assetTo: this.signer.address,
      collateralTo: this.signer.address,
      liquidityIn: liquidityIn,
    })
  }
  async removeLiquidityETHAsset(maturity: bigint, collateral: string, liquidityIn: bigint) {
    return await this.convenienceContract.removeLiquidityETHAsset({
      maturity: maturity,
      collateral: collateral,
      assetTo: this.signer.address,
      collateralTo: this.signer.address,
      liquidityIn: liquidityIn,
    })
  }
  async removeLiquidityETHCollateral(maturity: bigint, asset: string, liquidityIn: bigint) {
    return await this.convenienceContract.removeLiquidityETHCollateral({
      maturity: maturity,
      asset: asset,
      assetTo: this.signer.address,
      collateralTo: this.signer.address,
      liquidityIn: liquidityIn,
    })
  }
  async lendGivenBond(
    maturity: bigint,
    asset: string,
    collateral: string,
    assetIn: bigint,
    bondOut: bigint,
    minInsurance: bigint
  ) {
    return await this.convenienceContract.lendGivenBond({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      bondTo: this.signer.address,
      insuranceTo: this.signer.address,
      assetIn: assetIn,
      bondOut: bondOut,
      minInsurance: minInsurance,
      deadline: maturity,
    })
  }
  async lendGivenBondETHAsset(
    maturity: bigint,
    collateral: string,
    assetIn: bigint,
    bondOut: bigint,
    minInsurance: bigint
  ) {
    return await this.convenienceContract.lendGivenBondETHAsset(
      {
        maturity: maturity,
        collateral: collateral,
        bondTo: this.signer.address,
        insuranceTo: this.signer.address,
        bondOut: bondOut,
        minInsurance: minInsurance,
        deadline: maturity,
      },
      { value: assetIn }
    )
  }
  async lendGivenBondETHCollateral(
    maturity: bigint,
    asset: string,
    assetIn: bigint,
    bondOut: bigint,
    minInsurance: bigint
  ) {
    return await this.convenienceContract.lendGivenBondETHCollateral({
      maturity: maturity,
      asset: asset,
      bondTo: this.signer.address,
      insuranceTo: this.signer.address,
      assetIn: assetIn,
      bondOut: bondOut,
      minInsurance: minInsurance,
      deadline: maturity,
    })
  }
  async lendGivenInsurance(
    maturity: bigint,
    asset: string,
    collateral: string,
    assetIn: bigint,
    insuranceOut: bigint,
    minBond: bigint
  ) {
    return await this.convenienceContract.lendGivenInsurance({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      bondTo: this.signer.address,
      insuranceTo: this.signer.address,
      assetIn: assetIn,
      insuranceOut: insuranceOut,
      minBond: minBond,
      deadline: maturity,
    })
  }
  async lendGivenInsuranceETHAsset(
    maturity: bigint,
    collateral: string,
    assetIn: bigint,
    insuranceOut: bigint,
    minBond: bigint
  ) {
    return await this.convenienceContract.lendGivenInsuranceETHAsset(
      {
        maturity: maturity,
        collateral: collateral,
        bondTo: this.signer.address,
        insuranceTo: this.signer.address,
        insuranceOut: insuranceOut,
        minBond: minBond,
        deadline: maturity,
      },
      { value: assetIn }
    )
  }
  async lendGivenInsuranceETHCollateral(
    maturity: bigint,
    asset: string,
    assetIn: bigint,
    insuranceOut: bigint,
    minBond: bigint
  ) {
    return await this.convenienceContract.lendGivenInsuranceETHCollateral({
      maturity: maturity,
      asset: asset,
      bondTo: this.signer.address,
      insuranceTo: this.signer.address,
      assetIn: assetIn,
      insuranceOut: insuranceOut,
      minBond: minBond,
      deadline: maturity,
    })
  }
  async lendGivenPercent(
    maturity: bigint,
    asset: string,
    collateral: string,
    assetIn: bigint,
    minInsurance: bigint,
    minBond: bigint,
    percent: bigint
  ) {
    return await this.convenienceContract.lendGivenPercent({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      bondTo: this.signer.address,
      insuranceTo: this.signer.address,
      assetIn: assetIn,
      percent: percent,
      minInsurance: minInsurance,
      minBond: minBond,
      deadline: maturity,
    })
  }
  async lendGivenPercentETHAsset(
    maturity: bigint,
    collateral: string,
    assetIn:bigint,
    minInsurance: bigint,
    minBond: bigint,
    percent: bigint
  ) {
    return await this.convenienceContract.lendGivenPercentETHAsset({
      maturity: maturity,
      collateral: collateral,
      bondTo: this.signer.address,
      insuranceTo: this.signer.address,
      percent: percent,
      minInsurance: minInsurance,
      minBond: minBond,
      deadline: maturity,
    },{value: assetIn})
  }
  async lendGivenPercentETHCollateral(
    maturity: bigint,
    asset: string,
    assetIn: bigint,
    minInsurance: bigint,
    minBond: bigint,
    percent: bigint
  ) {
    return await this.convenienceContract.lendGivenPercentETHCollateral({
      maturity: maturity,
      asset: asset,
      bondTo: this.signer.address,
      insuranceTo: this.signer.address,
      assetIn: assetIn,
      percent: percent,
      minInsurance: minInsurance,
      minBond: minBond,
      deadline: maturity,
    })
  }
  async collectETHAsset(maturity: bigint,  collateral: string, claims: Claims) {
    return await this.convenienceContract.collectETHAsset({
      maturity: maturity,
      collateral: collateral,
      collateralTo: this.signer.address,
      assetTo: this.signer.address,
      claimsIn: claims,
    })
  }
  async collectETHCollateral(maturity: bigint,  asset: string, claims: Claims) {
    return await this.convenienceContract.collectETHCollateral({
      maturity: maturity,
      asset: asset,
      collateralTo: this.signer.address,
      assetTo: this.signer.address,
      claimsIn: claims,
    })
  }
  async collect(maturity: bigint, asset: string, collateral: string, claims: Claims) {
    return await this.convenienceContract.collect({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      collateralTo: this.signer.address,
      assetTo: this.signer.address,
      claimsIn: claims,
    })
  }
  async borrowGivenDebt(
    maturity: bigint,
    asset: string,
    collateral: string,
    assetOut: bigint,
    debtIn: bigint,
    maxCollateral: bigint
  ) {
    return await this.convenienceContract.borrowGivenDebt({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      dueTo: this.signer.address,
      assetTo: this.signer.address,
      assetOut: assetOut,
      debtIn: debtIn,
      maxCollateral: maxCollateral,
      deadline: maturity,
    })
  }
  async borrowGivenDebtETHAsset(
    maturity: bigint,
    collateral: string,
    assetOut: bigint,
    debtIn: bigint,
    maxCollateral: bigint
  ) {
    return await this.convenienceContract.borrowGivenDebtETHAsset({
      maturity: maturity,
      collateral: collateral,
      dueTo: this.signer.address,
      assetTo: this.signer.address,
      assetOut: assetOut,
      debtIn: debtIn,
      maxCollateral: maxCollateral,
      deadline: maturity,
    })
  }
  async borrowGivenDebtETHCollateral(
    maturity: bigint,
    asset: string,
    assetOut: bigint,
    debtIn: bigint,
    maxCollateral: bigint
  ) {
    return await this.convenienceContract.borrowGivenDebtETHCollateral(
      {
        maturity: maturity,
        asset: asset,
        dueTo: this.signer.address,
        assetTo: this.signer.address,
        assetOut: assetOut,
        debtIn: debtIn,
        deadline: maturity,
      },
      { value: maxCollateral }
    )
  }
  async borrowGivenCollateral(
    maturity: bigint,
    asset: string,
    collateral: string,
    assetOut: bigint,
    maxDebt: bigint,
    collateralIn: bigint
  ) {
    return await this.convenienceContract.borrowGivenCollateral({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      dueTo: this.signer.address,
      assetTo: this.signer.address,
      assetOut: assetOut,
      maxDebt: maxDebt,
      collateralIn: collateralIn,
      deadline: maturity,
    })
  }
  async borrowGivenCollateralETHAsset(
    maturity: bigint,
    collateral: string,
    assetOut: bigint,
    maxDebt: bigint,
    collateralIn: bigint
  ) {
    return await this.convenienceContract.borrowGivenCollateralETHAsset({
      maturity: maturity,
      collateral: collateral,
      dueTo: this.signer.address,
      assetTo: this.signer.address,
      assetOut: assetOut,
      maxDebt: maxDebt,
      collateralIn: collateralIn,
      deadline: maturity,
    })
  }
  async borrowGivenCollateralETHCollateral(
    maturity: bigint,
    asset: string,
    assetOut: bigint,
    maxDebt: bigint,
    collateralIn: bigint
  ) {
    return await this.convenienceContract.borrowGivenCollateralETHCollateral(
      {
        maturity: maturity,
        asset: asset,
        dueTo: this.signer.address,
        assetTo: this.signer.address,
        assetOut: assetOut,
        maxDebt: maxDebt,
        deadline: maturity,
      },
      { value: collateralIn }
    )
  }
  async borrowGivenPercent(
    maturity: bigint,
    asset: string,
    collateral: string,
    assetOut: bigint,
    maxDebt: bigint,
    maxCollateral: bigint,
    percent: bigint
  ) {
    return await this.convenienceContract.borrowGivenPercent({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      dueTo: this.signer.address,
      assetTo: this.signer.address,
      assetOut: assetOut,
      maxDebt: maxDebt,
      maxCollateral: maxCollateral,
      percent: percent,
      deadline: maturity,
    })
  }
  async borrowGivenPercentETHAsset(
    maturity: bigint,
    collateral: string,
    assetOut: bigint,
    maxDebt: bigint,
    maxCollateral: bigint,
    percent: bigint
  ) {
    return await this.convenienceContract.borrowGivenPercentETHAsset({
      maturity: maturity,
      collateral: collateral,
      dueTo: this.signer.address,
      assetTo: this.signer.address,
      assetOut: assetOut,
      maxDebt: maxDebt,
      maxCollateral: maxCollateral,
      percent: percent,
      deadline: maturity,
    })
  }
  async borrowGivenPercentETHCollateral(
    maturity: bigint,
    asset: string,
    assetOut: bigint,
    maxDebt: bigint,
    maxCollateral: bigint,
    percent: bigint
  ) {
    return await this.convenienceContract.borrowGivenPercentETHCollateral(
      {
        maturity: maturity,
        asset: asset,
        dueTo: this.signer.address,
        assetTo: this.signer.address,
        assetOut: assetOut,
        maxDebt: maxDebt,
        percent: percent,
        deadline: maturity,
      },
      { value: maxCollateral }
    )
  }
  async repay(maturity: bigint, asset: string, collateral: string, ids: bigint[], maxAssetsIn: bigint[]) {
    return await this.convenienceContract.repay({
      maturity: maturity,
      asset: asset,
      collateral: collateral,
      collateralTo: this.signer.address,
      ids: ids,
      maxAssetsIn: maxAssetsIn,
      deadline: maturity,
    }
    )
  }
  async repayETHAsset(maturity: bigint, collateral: string, ids: bigint[], maxAssetsIn: bigint[]) {
    return await this.convenienceContract.repayETHAsset(
      {
      maturity: maturity,
      collateral: collateral,
      collateralTo: this.signer.address,
      ids: ids,
      maxAssetsIn: maxAssetsIn,
      deadline: maturity,
    },{
      value: maxAssetsIn.reduce((a, b) => a + b, 0n)
    }
    )}
    async repayETHCollateral(maturity: bigint, asset: string, ids: bigint[], maxAssetsIn: bigint[]) {
      return await this.convenienceContract.repayETHCollateral({
        maturity: maturity,
        asset: asset,
        collateralTo: this.signer.address,
        ids: ids,
        maxAssetsIn: maxAssetsIn,
        deadline: maturity,
      })
}
}

export async function convenienceInit(
  maturity: bigint,
  asset: TestToken,
  collateral: TestToken,
  signerWithAddress: SignerWithAddress
) {
  const { convenience, factory, weth } = await deploy(asset, collateral, maturity)
  return new Convenience(convenience, factory, weth, signerWithAddress)
}
