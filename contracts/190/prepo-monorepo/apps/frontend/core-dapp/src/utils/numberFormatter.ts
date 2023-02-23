import { formatPercent, formatUsd, numFormatter } from './number-utils'

/**
 * Exposes all the possible formats that you will need to apply to numbers across the app
 * @namespace numberFormatter
 */
export const numberFormatter = {
  /**
   * Will return 3 significant digits. Example: 1.20M
   * @memberof numberFormatter
   * @method significantDigits
   * @param value - The value that will be formatted.
   */
  significantDigits: (value: number | string): string =>
    numFormatter(value, { significantDigits: 3 }),
  /**
   * Will return the value in percentage without the % suffix. Example: 12.3 for 12.3%.
   * @memberof numberFormatter
   * @method rawPercent
   * @param value - The value that will be formatted.
   * @param precision - Default = 1.
   */
  rawPercent: (value: number | string, precision = 1): string | undefined =>
    formatPercent(value, precision),
  /**
   * Will return the value as a percent string. Example: 12.3%. You can send 'precision' as parameter
   * @memberof numberFormatter
   * @method percent
   * @param value - The value that will be formatted.
   * @param precision - Default = 1.
   */
  percent: (value: number | string, precision = 1): string | undefined => {
    const formatResult = formatPercent(value, precision)
    return formatResult ? `${formatResult}%` : undefined
  },
  /**
   * Will return the value with decimal separator as comma. Example: 1,200,000
   * @memberof numberFormatter
   * @method withCommas
   * @param value - The value that will be formatted.
   */
  withCommas: (value: number | undefined): string => {
    if (!value) return '0'
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  },

  /**
   * Will return the value as USD.
   * Returns the number with CURRENCY_PRECISION configured on the application
   * Example: $1,200,000.00
   * @memberof numberFormatter
   * @method toUsd
   * @param value - The value that will be formatted.
   */
  toUsd: (value: number | string | undefined): string => formatUsd(value),
}
