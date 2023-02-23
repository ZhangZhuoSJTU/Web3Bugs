// Helps to cut decimals from a number by manipulating the string and not using Javascript toFixed methods

import { CURRENCY_PRECISION } from 'prepo-constants'

type Options = {
  hideCommas?: boolean
  maxDecimalDigits?: number
}
// toFixed methods will round the number to the nearest integer and won't be 100% accurate
export const truncateAmountString = (
  amountAsString: string,
  { hideCommas, maxDecimalDigits }: Options = {}
): string => {
  let output = amountAsString
  const decimals = maxDecimalDigits ?? CURRENCY_PRECISION
  if (amountAsString.includes('.')) {
    const parts = amountAsString.split('.')
    output = decimals === 0 ? parts[0] : `${parts[0]}.${parts[1].slice(0, decimals)}`
  }
  return hideCommas ? output : (+output).toLocaleString()
}
