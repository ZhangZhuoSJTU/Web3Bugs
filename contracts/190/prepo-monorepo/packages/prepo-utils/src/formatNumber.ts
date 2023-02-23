import { FormatNumber } from './types'

export const formatNumber: FormatNumber = (number, options): string => {
  const numberFormatOptions: Intl.NumberFormatOptions = {}
  if (options?.compact) {
    numberFormatOptions.notation = 'compact'
  }
  if (options?.usd) {
    numberFormatOptions.style = 'currency'
    numberFormatOptions.currency = 'USD'
  }
  if (number === undefined) return ''
  return new Intl.NumberFormat('en-US', numberFormatOptions).format(Number(number))
}
