import { parseUnits } from 'ethers/lib/utils'
import { getDecimals } from './getDecimals'
import { safeStringBN } from './safeStringBN'

export const validateStringToBN = (input: string, decimals?: number): boolean => {
  if (decimals === undefined) return false
  if (input === '') return true
  try {
    const inputBN = parseUnits(safeStringBN(input), decimals)
    const inputDecimals = getDecimals(input)
    return !inputBN.lt(0) && inputDecimals <= decimals
  } catch (error) {
    return false
  }
}
