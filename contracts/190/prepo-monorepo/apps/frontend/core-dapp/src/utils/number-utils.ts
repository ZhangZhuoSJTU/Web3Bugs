import { CURRENCY_PRECISION } from 'prepo-constants'
import { format } from 'd3'
import { BigNumber } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'
import { ERC20_UNITS } from '../lib/constants'

/** It is common to use string type to maintain values with precision.
 * If the output is undefined, this input cannot be converted to percent (e.g. invalid string) */
export function formatPercent(percent: number | string, precision = 1): string | undefined {
  const transformedPercent = +percent
  if (
    Number.isNaN(transformedPercent) ||
    percent === undefined ||
    transformedPercent > 1 ||
    transformedPercent < -1
  ) {
    return undefined
  }
  return (transformedPercent * 100).toFixed(precision)
}

export const makeAddStep = (value: number): number => {
  if (value >= 1000000000) {
    return 1000000000
  }
  if (value >= 1000000) {
    return 1000000
  }
  if (value >= 1000) {
    return 1000
  }
  return 1
}

export const makeMinusStep = (value: number): number => {
  if (value > 1000000000) {
    return 1000000000
  }
  if (value > 1000000) {
    return 1000000
  }
  if (value > 1000) {
    return 1000
  }
  return 1
}

enum FormatterSettings {
  SIGNIFICANT_DIGITS = '.[digits]s',
  TRIMS_INSIGNIFICANT_TRAILING_ZEROS = '~s',
}

type NumFormatterSettings = {
  significantDigits?: number
}

/**
 * Replace d3.format assigning G as Giga
 * With B as Billion
 */
const replaceGigaToBillion = (value: string): string => value.replace(/G/, 'B')

/**
 * Returns a large number with a SI Prefix
 * 100k, 100M, 10B
 * @param amount - The amount to format
 * @param numFormatterSettings - The settings object
 * @param numFormatterSettings.significantDigits - The amount of significant digits that the output should have. Ex: 12.3k for 3 significantDigits
 * @param numFormatterSettings.precisionDigits - The amount of precision digits that the output should have. Ex: 12.32k for 2 precisionDigits
 */
export const numFormatter = (
  num: number | string,
  numFormatterSettings?: NumFormatterSettings
): string => {
  const numValue = typeof num === 'string' ? parseInt(num, 10) : num

  const rule = numFormatterSettings?.significantDigits
    ? FormatterSettings.SIGNIFICANT_DIGITS.replace(
        '[digits]',
        numFormatterSettings.significantDigits.toString()
      )
    : FormatterSettings.TRIMS_INSIGNIFICANT_TRAILING_ZEROS

  return replaceGigaToBillion(format(rule)(numValue)).toUpperCase()
}

export const balanceToNumber = (balanceOfSigner: BigNumber): number =>
  Number(formatUnits(balanceOfSigner.toString(), ERC20_UNITS))

/**
 * Makes sure to avoid getting large string numbers like
 * 14.999999999999999999 when converting from BigNumber to string
 * This will always return the amount of digits that are needed according to our currency precision
 * @returns string
 */
export const normalizeDecimalPrecision = (value: string | number | undefined): string => {
  if (!value || Number.isNaN(value)) return '0'
  const numberAsString = `${value}`
  const decimalsPrecision = `^-?\\d+(?:\\.\\d{0,${CURRENCY_PRECISION}})?`
  const matchResult = numberAsString.match(decimalsPrecision)
  return matchResult ? matchResult[0] : numberAsString
}

/**
 * Uses javascript internationalization number format for USD
 * Returns the number with CURRENCY_PRECISION configured on the application
 * @param amount - The amount to format
 * @param [decimals=true] - If true, the amount will be formatted with decimals
 */
export function formatUsd(amount: number | string | undefined, decimals = true): string {
  const normalizeAmount = normalizeDecimalPrecision(amount)
  const usd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(+normalizeAmount)

  if (decimals) return usd

  return usd.split('.')[0]
}
