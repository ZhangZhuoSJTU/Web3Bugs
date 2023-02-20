import { BigNumber } from '@ethersproject/bignumber'
import { pseudoRandomBigUint } from '../shared/Helper'
import * as Mint from './MintTestCases'

const MaxUint112 = BigNumber.from(2).pow(112).sub(1)
const MaxUint64 = BigNumber.from(2).pow(64).sub(1)
const MaxUint32 = BigNumber.from(2).pow(32).sub(1)
const MaxUint16 = BigNumber.from(2).pow(16).sub(1)

export interface Lend {
  assetIn: bigint
  collateralIn: bigint
  interestIncrease: bigint
  cdpIncrease: bigint
  maturity: bigint
  currentTimeStamp: bigint
  lendAssetIn: bigint
  lendInterestDecrease: bigint
  lendCdpDecrease: bigint
}

export interface LendParams {
  assetIn: bigint
  interestDecrease: bigint
  cdpDecrease: bigint
}

export async function lend(): Promise<Lend[]> {
  const mintTests = await Mint.mint()
  const lendCases: Lend[] = []
  for (let i = 0; i < mintTests.length; i++) {
    lendCases.push({
      assetIn: mintTests[i].assetIn,
      collateralIn: mintTests[i].collateralIn,
      interestIncrease: mintTests[i].interestIncrease,
      cdpIncrease: mintTests[i].cdpIncrease,
      maturity: mintTests[i].maturity,
      currentTimeStamp: mintTests[i].currentTimeStamp,
      lendAssetIn: (BigInt(MaxUint112.toString()) - mintTests[i].assetIn) / 2n,
      lendInterestDecrease: mintTests[i].interestIncrease / 10n,
      lendCdpDecrease: pseudoRandomBigUint(MaxUint112),
    })
  }
  return lendCases
}
