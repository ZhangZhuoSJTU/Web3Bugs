import { BigNumber } from '@ethersproject/bignumber'
import { pseudoRandomBigUint } from '../shared/Helper'
import { ConstantProduct } from '../shared/PairInterface'

const MaxUint112 = BigNumber.from(2).pow(112).sub(1)
const MaxUint24 = BigNumber.from(2).pow(24).sub(1)
export interface Lend {
  lendAssetIn: bigint
  lendInterestDecrease: bigint
  lendCdpDecrease: bigint
}

export interface LendParams {
  assetIn: bigint
  interestDecrease: bigint
  cdpDecrease: bigint
}

export async function lend(state: ConstantProduct): Promise<Lend> {
  const currentProduct = BigInt(((state.interest * state.cdp)) * state.asset);
  let lendAssetIn = pseudoRandomBigUint(MaxUint112.sub(BigNumber.from(String(state.asset))));
  while(lendAssetIn<state.asset)
  { 
    let diff = state.asset - lendAssetIn;
    lendAssetIn += diff + pseudoRandomBigUint(BigNumber.from(2**10));
  }
  let lendInterestDecrease: bigint = pseudoRandomBigUint(BigNumber.from(state.interest));
  let lendCdpDecrease: bigint = pseudoRandomBigUint(BigNumber.from(state.cdp));
  let newProduct = (state.asset + lendAssetIn)*(state.interest - lendInterestDecrease)*(state.cdp - lendCdpDecrease);
  while(
    newProduct<currentProduct
  ){
    lendInterestDecrease =  pseudoRandomBigUint(MaxUint24);
    lendCdpDecrease = pseudoRandomBigUint(MaxUint24);
    newProduct = (state.asset + lendAssetIn)*(state.interest - lendInterestDecrease)*(state.cdp - lendCdpDecrease);
  }
  return ({
    lendAssetIn,
    lendInterestDecrease,
    lendCdpDecrease
  })
}
