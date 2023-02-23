import { truncateDecimals } from './truncateDecimals'

/**
 * Find ideal decimals lenth to display in UI. This should never be used for calculation.
 * This function intends to recreate the decimals display logic on Uniswap.
 */
export const displayDecimals = (value: string | number): string => {
  const valueInString = `${value}`
  // make sure we're not comparing super long number
  // which will make the math invalid
  const validJSNumber = truncateDecimals(valueInString)
  let decimals = 0
  if (validJSNumber < 1000) decimals = 1
  if (validJSNumber < 100) decimals = 2
  if (validJSNumber < 10) decimals = 3
  if (validJSNumber < 1) decimals = 8
  return truncateDecimals(valueInString, decimals).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  })
}
