import { BigNumber, ethers } from 'ethers'

export const transformBigNumber = (rawValueFromSC: [BigNumber] | undefined): number | undefined => {
  if (rawValueFromSC === undefined) return undefined
  return +ethers.utils.formatEther(rawValueFromSC[0])
}

export const getContractCall = (rawValueFromSC: [BigNumber] | undefined): BigNumber | undefined => {
  if (rawValueFromSC === undefined) return undefined
  return rawValueFromSC[0]
}
