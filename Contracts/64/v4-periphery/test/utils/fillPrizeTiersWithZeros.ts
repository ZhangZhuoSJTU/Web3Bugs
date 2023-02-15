import { BigNumber } from 'ethers';

export function fillPrizeTiersWithZeros(tiers: BigNumber[]): BigNumber[]{
    const existingLength = tiers.length
    const lengthOfZeroesRequired = 16 - existingLength
    return [...tiers, ...Array(lengthOfZeroesRequired).fill(BigNumber.from(0))]
}
