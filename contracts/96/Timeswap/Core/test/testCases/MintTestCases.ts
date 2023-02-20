import { BigNumber } from '@ethersproject/bignumber'
import { now, pseudoRandomBigUint } from '../shared/Helper'

const MaxUint112 = BigNumber.from(2).pow(112).sub(1)
const MaxUint105 = BigNumber.from(2).pow(105).sub(1)

const count = 20
export interface MintParams {
  assetIn: bigint
  collateralIn: bigint
  interestIncrease: bigint
  cdpIncrease: bigint
  maturity: bigint
  currentTimeStamp: bigint
}

export interface MintBorrowParams {
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
export interface Mint {
  Success: MintParams[]
  Failure: MintParams[]
}

export async function mint(): Promise<MintParams[]> {
  const testCases = await mintTestCases()
  return testCases
}

export async function mintTestCases(): Promise<MintParams[]> {
  const nt = await now()
  const testcases = Array(count)
    .fill(null)
    .map(() => {
      return {
        assetIn: pseudoRandomBigUint(MaxUint112),
        collateralIn: pseudoRandomBigUint(MaxUint112),
        interestIncrease: pseudoRandomBigUint(MaxUint112),
        cdpIncrease: pseudoRandomBigUint(MaxUint105),
        maturity: nt + 31556952n,
        currentTimeStamp: nt,
      }
    })
  return testcases
}

// export async function mintSuccessCheck({
//   assetIn,
//   interestIncrease,
//   cdpIncrease,
//   maturity,
//   currentTimeStamp,
// }: MintParams): Promise<boolean> {
//   if (!(assetIn > 0n && interestIncrease > 0n && cdpIncrease > 0n)) {
//     return false
//   } else {
//     return true
//   }
// }

// export async function mintFailureCheck(params: MintParams): Promise<boolean> {
//   return !(await mintSuccessCheck(params))
// }

export async function lossAndMint(): Promise<MintBorrowParams[]> {
  const nt = await now()
  const TestCases = [
    {
      assetIn: 10n,
      collateralIn: 5n,
      interestIncrease: 20n,
      cdpIncrease: 10n,
      maturity: 3908191630n,
      lendAssetIn: 1000n,
      lendInterestDecrease: 10n,
      lendCdpDecrease: 2n,
      currentTimeStamp: nt,
      borrowAssetOut: 100n,
      borrowCollateralIn: 100n,
      borrowInterestIncrease: 40n,
      borrowCdpIncrease: 500n,
    },
  ]
  return TestCases
}
