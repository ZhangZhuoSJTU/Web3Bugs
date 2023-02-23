const BREAKPOINTS = [13, 26, 52, 78, 104]
export const INTERVALS = BREAKPOINTS.length
const MAX_POINTS = 107
export const PRECISION = 1e16
export const DEFAULT_FEE_RATE = 10.0
export const DEFAULT_TOOLTIP_PRECISION = 4
export const DEFAULT_TOTAL_WEEK = 40

// for some reason it doesn't render 0 tick if you pass it as number
export const X_AXIS_TICKS = ['0', ...BREAKPOINTS]
export const Y_AXIS_TICKS = [1, 1.2, 1.4, 1.6, 1.8]

export const labelFormatter = (week: number): string => `+${week} weeks`

interface DataType {
  value: number
  current?: number
  week: number
}

const getCurrentMultiplier = (value: number): number => {
  if (value < 13) {
    // 0-3 months = 1x
    return 1
  }
  if (value < 26) {
    // 3 months = 1.2x
    return 1.2
  }
  if (value < 52) {
    // 6 months = 1.3x
    return 1.3
  }
  if (value < 78) {
    // 12 months = 1.4x
    return 1.4
  }
  if (value < 104) {
    // 18 months = 1.5x
    return 1.5
  }
  // > 24 months = 1.6x
  return 1.6
}

export const generateMultiplierData = (currentWeek?: number): DataType[] => {
  const intervals = [...Array.from(Array(MAX_POINTS)).keys()]
  return intervals.map((week) => ({
    value: getCurrentMultiplier(week),
    week,
    current: currentWeek === week ? getCurrentMultiplier(week) : undefined,
  }))
}

export type UnstakingFeeChartProps = {
  feeRate: number
  tooltipPrecision: number
  totalWeek: number
  currentWeek?: number
}

/* https://github.com/mstable/mStable-apps/blob/master/apps/governance/src/app/utils/index.tsx
 */
export const getRedemptionFee = (weeksStaked: number, feeRate: number): number => {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  let _feeRate = 0
  if (weeksStaked > 3) {
    _feeRate = Math.sqrt(300e18 / weeksStaked) * 1e7
    _feeRate = _feeRate < 25e15 ? 0 : _feeRate - 25e15
  } else {
    _feeRate = feeRate * PRECISION
  }
  return _feeRate / PRECISION
}

export const generateFeeData = ({
  feeRate,
  totalWeek,
  currentWeek,
}: Pick<UnstakingFeeChartProps, 'feeRate' | 'totalWeek' | 'currentWeek'>): DataType[] => {
  const intervals = [...new Array(totalWeek).keys()]
  return intervals.map((week) => ({
    value: getRedemptionFee(week, feeRate),
    week,
    current: currentWeek === week ? getRedemptionFee(week, feeRate) : undefined,
  }))
}
