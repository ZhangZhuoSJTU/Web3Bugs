import { Range } from '../types/market.types'

export const getMultiplier = ([floor, ceiling]: Range): number =>
  1 / (1 - (floor / ceiling) ** 0.25)
