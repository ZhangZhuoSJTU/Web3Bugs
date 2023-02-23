import { SAFE_DECIMALS } from 'prepo-constants'

export const truncateDecimals = (value: string, decimal = SAFE_DECIMALS): number => {
  const parts = value.split('.')
  if (parts[1] && parts[1].length > decimal) {
    return +`${parts[0]}.${parts[1].substring(0, decimal)}`
  }
  return +value
}
