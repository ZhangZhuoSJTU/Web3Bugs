import { Bounds } from '../../position/markets'
import { formatValuation } from '../../../helpers'
import { Periods, periods } from '../../position/position-slice'
import { Outcome } from '../../position/outcome-selector'

export const getMarketValuationRange = (marketValuationBounds: Bounds): string => {
  const { ceil, floor } = marketValuationBounds

  return `$${formatValuation(floor)} - ${formatValuation(ceil)}`
}

export const getPositionColor = (outcome: Outcome): 'green' | 'red' => {
  const positionColor = outcome.profit.marketPosition.amount > 0 ? 'green' : 'red'

  return positionColor
}

export const floatToPercentage = (value: number): string => {
  const roundedValue = Math.round(value * 100)
  return `${roundedValue}`
}

export const floatToPercentageFormat = (value: number): string => `${floatToPercentage(value)}%`

export const percentageToFloat = (value: number): string => `${value / 100}`

export const formatTwoDigits = (numberValue: number | string): string => {
  if (typeof numberValue === 'string') {
    return parseFloat(numberValue).toFixed(2)
  }

  return numberValue.toFixed(2)
}

export const getHoldingPeriodLabel = (unit: keyof Periods, val: number): string => {
  if (val === 1) return periods[unit].substring(0, periods[unit].length - 1)
  return periods[unit]
}

export const getCapitalEfficiencyLabelFormat = (numberValue: number): string => {
  const twoDecimalsNumber = numberValue.toFixed(2)
  return `${twoDecimalsNumber}x`
}
