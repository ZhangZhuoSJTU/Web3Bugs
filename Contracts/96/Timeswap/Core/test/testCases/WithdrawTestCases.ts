import { Lend } from '.'
import { now } from '../shared/Helper'
import { TotalClaims } from '../shared/PairInterface'

export async function withdraw(): Promise<Lend[]> {
  const nt = await now()
  const TestCases = [
    {
      assetIn: 0n,
      collateralIn: 0n,
      interestIncrease: 0n,
      cdpIncrease: 0n,
      maturity: 0n,
      currentTimeStamp: 0n,
      lendAssetIn: 0n,
      lendInterestDecrease: 0n,
      lendCdpDecrease: 0n,
    },
  //   {
  //     assetIn: 3801966304736218554100000000000000n,
  //     collateralIn: 691611727967172850880000000000000n,
  //     interestIncrease: 69081308498259119737000000000000n,
  //     cdpIncrease: 36956852203081300590000000000000n,
  //     maturity: 1671630858n,
  //     currentTimeStamp: 1640073906n,
  //     lendAssetIn: 695165276899304537215248164610047n,
  //     lendInterestDecrease: 6908130849825911973700000000000n,
  //     lendCdpDecrease: 5143599301800517587600000000000000n,
  //   },
  //   // case 4
  //   {
  //     assetIn: 3798822415789779506800000000000000n,
  //     collateralIn: 2461351597358750248800000000000000n,
  //     interestIncrease: 503132579856478583440000000000000n,
  //     cdpIncrease: 24569522184174566927000000000000n,
  //     maturity: 1671630858n,
  //     currentTimeStamp: 1640073906n,
  //     lendAssetIn: 696737221372524060865248164610047n,
  //     lendInterestDecrease: 50313257985647858344000000000000n,
  //     lendCdpDecrease: 3012536589789303791900000000000000n,
  //   },
  //   // case 5
  //   {
  //     assetIn: 289815292528466169360000000000000n,
  //     collateralIn: 2903110031440391639900000000000000n,
  //     interestIncrease: 61262843816330564521000000000000n,
  //     cdpIncrease: 9358994322569672593800000000000n,
  //     maturity: 1671630858n,
  //     currentTimeStamp: 1640073906n,
  //     lendAssetIn: 2451240783003180729585248164610047n,
  //     lendInterestDecrease: 6126284381633056452100000000000n,
  //     lendCdpDecrease: 3641221283262960976200000000000000n,
  //   },
  //   {
  //     assetIn: 1652311766053962108100000000000000n,
  //     collateralIn: 4988126218962352188500000000000000n,
  //     interestIncrease: 105138284119828367370000000000000n,
  //     cdpIncrease: 26819310565491525977000000000000n,
  //     maturity: 1671630858n,
  //     currentTimeStamp: 1640073906n,
  //     lendAssetIn: 1769992546240432760215248164610047n,
  //     lendInterestDecrease: 10513828411982836737000000000000n,
  //     lendCdpDecrease: 3286627487497870276200000000000000n,
  //   },
  ]
  return TestCases
}

export interface LendAndBorrow {
  assetIn: bigint
  collateralIn: bigint
  interestIncrease: bigint
  cdpIncrease: bigint
  maturity: bigint
  currentTimeStamp: bigint
  lendAssetIn: bigint
  lendInterestDecrease: bigint
  lendCdpDecrease: bigint
  borrowAssetOut: bigint
  borrowCollateralIn: bigint
  borrowInterestIncrease: bigint
  borrowCdpIncrease: bigint
}
export interface WithdrawParams {
  claimsIn: TotalClaims
}

export async function lossWithdraw(): Promise<LendAndBorrow[]> {
  const nt = await now()
  const TestCases = [
    {
      assetIn: 1000n,
      collateralIn: 5n,
      interestIncrease: 2n,
      cdpIncrease: 2231034977219894488200000000000000n,
      maturity: 3908191630n,
      currentTimeStamp: nt,
      lendAssetIn: 200000n,
      lendInterestDecrease: 1n,
      lendCdpDecrease: 1000n,
      borrowAssetOut: 20500n,
      borrowCollateralIn: 1000n,
      borrowInterestIncrease: 4000n,
      borrowCdpIncrease: 5000n,
    },
  ]
  return TestCases
}
