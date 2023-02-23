import { PoolBounds } from 'prepo-sdk'
import { Bounds } from './features/position/markets'
import { DELTA } from './constants'

export function formatPercent(decimal: number, suffix = true): string {
  if (decimal > 0.1 - DELTA || decimal < -0.1 + DELTA) {
    return `${(decimal * 100).toFixed(0)}${suffix ? '%' : ''}`
  }
  return `${(decimal * 100).toFixed(1)}${suffix ? '%' : ''}`
}

export function percentToFloat(percentString: string): number {
  const valueString = percentString.replace('%', '')
  const value = parseFloat(valueString)
  return value / 100
}

export function formatUsd(numberRaw: number | undefined): string {
  if (numberRaw === undefined) return '$0'
  // Remove - sign from 0 if present
  const number = Math.round(numberRaw) === 0 ? 0 : numberRaw
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  })
    .format(number)
    .split('.')[0]
}

export function randomNumberFromInterval(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function formatValuation(val: number): string {
  return val >= 1 ? `${val}B` : `${val * 1000}M`
}

export const formatValuationNumber = (n: number): string => `$${formatValuation(n)}`

export function calcValuationPrecision(min: number, max: number): number {
  if (Math.min(min, max) <= 0.01) return 0.001
  if (Math.min(min, max) <= 0.1) return 0.01
  if (Math.min(min, max) <= 1) return 0.1
  return 1
}

export function roundValuation({ floor, ceil }: Bounds, val: number): number {
  if (Math.min(floor, ceil) <= 0.01) return Math.round(val * 1000) / 1000
  if (Math.min(floor, ceil) <= 0.1) return Math.round(val * 100) / 100
  if (Math.min(floor, ceil) <= 1) return Math.round(val * 10) / 10
  return Math.round(val)
}

export function valuationToLongPrice(
  valuationBounds: PoolBounds,
  marketBounds: PoolBounds,
  valuation: number
): number {
  const valuationR =
    (valuation - valuationBounds.floor) / (valuationBounds.ceil - valuationBounds.floor)

  return valuationR * (marketBounds.ceil - marketBounds.floor) + marketBounds.floor
}

export const forceNumInRange = (val: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, val))

export function checkValuationRangeValid({ floor, ceil }: Bounds): boolean {
  if (floor === 0 || ceil === 0 || floor >= ceil) return false
  return true
}
