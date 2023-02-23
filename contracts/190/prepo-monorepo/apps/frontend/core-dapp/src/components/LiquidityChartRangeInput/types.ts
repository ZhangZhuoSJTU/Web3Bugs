export enum Bound {
  LOWER = 'LOWER',
  UPPER = 'UPPER',
}

export enum PoolState {
  LOADING,
  NOT_EXISTS,
  EXISTS,
  INVALID,
}

export type ChartEntry = {
  activeLiquidity: number
  price0: number
}

export type ZoomLevels = {
  initialMin: number
  initialMax: number
  min: number
  max: number
}

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export type BrushLabelValueType = (direction: 'left' | 'right', value: number) => string
