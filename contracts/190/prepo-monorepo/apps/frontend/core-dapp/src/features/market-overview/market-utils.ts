import { Range } from '../../types/market.types'
import { numberFormatter } from '../../utils/numberFormatter'

const { significantDigits } = numberFormatter

export const getValuationRangeString = (valuationRange: Range): string => {
  const [min, max] = valuationRange
  return `$${significantDigits(min)} - $${significantDigits(max)}`
}
