import { BigNumber } from '@ethersproject/bignumber'
import { divUp } from '../libraries/Math'
import { pseudoRandomBigUint } from '../shared/Helper'
import { ConstantProduct, State, Tokens } from '../shared/PairInterface'
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

export async function borrow(state: ConstantProduct, reserves: Tokens): Promise<any> {
  const assetOut = await pseudoRandomBigUint(BigNumber.from(state.asset));
  const borrowCollateralIn = await pseudoRandomBigUint(BigNumber.from(state.asset));
  const interestIncrease = await pseudoRandomBigUint(BigNumber.from(divUp((assetOut*state.interest), reserves.asset)));
  const cdpIncrease = await pseudoRandomBigUint(BigNumber.from(divUp((assetOut*state.cdp),reserves.asset)));
  return ({
    assetOut,
    borrowCollateralIn,
    interestIncrease,
    cdpIncrease
  })
}

