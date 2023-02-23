import { createSelector } from '@reduxjs/toolkit'
import { Bounds } from './markets'
import { RootState } from '../../app/store'

export const calcMaxCapitalEfficiency = (bounds: Bounds): number => {
  const { floor, ceil } = bounds
  // Equation https://twitter.com/haydenzadams/status/1380217938867843072
  return 1 / (1 - (floor / ceil) ** (1 / 4))
}

export const selectMaxCapitalEfficiency = createSelector(
  (state: RootState): Bounds => state.position.payoutRange,
  calcMaxCapitalEfficiency
)
