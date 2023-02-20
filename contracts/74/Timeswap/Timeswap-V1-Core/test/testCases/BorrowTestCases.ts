import { BigNumber } from '@ethersproject/bignumber'
import { pseudoRandomBigUint } from '../shared/Helper'
import * as Mint from './MintTestCases'

const MaxUint112 = BigNumber.from(2).pow(112).sub(1)
const MaxUint32 = BigNumber.from(2).pow(32).sub(1)

export interface Borrow {
  assetIn: bigint
  collateralIn: bigint
  interestIncrease: bigint
  cdpIncrease: bigint
  maturity: bigint
  currentTimeStamp: bigint
  borrowAssetOut: bigint
  borrowCollateralIn: bigint
  borrowInterestIncrease: bigint
  borrowCdpIncrease: bigint
}
export interface BorrowParams {
  assetOut: bigint
  collateralIn: bigint
  interestIncrease: bigint
  cdpIncrease: bigint
}

export async function borrow(): Promise<Borrow[]> {
  const mintTests = await Mint.mint()
  const borrowCases: Borrow[] = []
  for (let i = 0; i < mintTests.length; i++) {
    // for (let i = 0; i < 1; i++) {
    borrowCases.push(
      // {
      //     assetIn: 1914586276518461540700000000000000n,
      //     collateralIn: 4558233692020528389400000000000000n,
      //     interestIncrease: 498141581172987214260000000000000n,
      //     cdpIncrease: 7587678945779449949200000000000n,
      //     maturity: 1671551003n,
      //     currentTimeStamp: 1639994051n,
      //     borrowAssetOut: 1638855291008183043915248164610047n,
      //     borrowCollateralIn: 1609105904574335078900000000000000n,
      //     borrowInterestIncrease: 2347077638680920207135248164610047n,
      //     borrowCdpIncrease: 2592354589794524089290648164610047n
      //   }
      {
        assetIn: mintTests[i].assetIn,
        collateralIn: mintTests[i].collateralIn,
        interestIncrease: mintTests[i].interestIncrease,
        cdpIncrease: mintTests[i].cdpIncrease,
        maturity: mintTests[i].maturity,
        currentTimeStamp: mintTests[i].currentTimeStamp,
        borrowAssetOut: (BigInt(MaxUint112.toString()) - mintTests[i].assetIn) / 2n,
        borrowCollateralIn: pseudoRandomBigUint(MaxUint112) / 2n,
        borrowInterestIncrease: (BigInt(MaxUint112.toString()) - mintTests[i].interestIncrease) / 2n,
        borrowCdpIncrease: (BigInt(MaxUint112.toString()) - mintTests[i].cdpIncrease) / 2n,
      }
    )
  }
  return borrowCases
}

//TODO: The following tx is not reverting.  However the typescript check shows that it will fail due to "Invariance".  Need to debug and clear
// {
//   assetIn: 1914586276518461540700000000000000n,
//   collateralIn: 4558233692020528389400000000000000n,
//   interestIncrease: 498141581172987214260000000000000n,
//   cdpIncrease: 7587678945779449949200000000000n,
//   maturity: 1671551003n,
//   currentTimeStamp: 1639994051n,
//   borrowAssetOut: 1638855291008183043915248164610047n,
//   borrowCollateralIn: 1609105904574335078900000000000000n,
//   borrowInterestIncrease: 2347077638680920207135248164610047n,
//   borrowCdpIncrease: 2592354589794524089290648164610047n
// }
