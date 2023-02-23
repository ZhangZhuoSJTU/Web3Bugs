import { createSelector } from '@reduxjs/toolkit'
import { PositionState } from './position-slice'
import { simulateOutcome } from './outcome-selector'
import { calcMaxCapitalEfficiency } from './max-capital-efficiency-selector'
import { RootState } from '../../app/store'
import { calcValuationPrecision, roundValuation } from '../../helpers'

interface ScenarioBounds {
  maxProfit: [number, number]
  maxLoss: [number, number]
}

// Find the exit valuation that will lead to a max loss, which is a local minima
function findMaxLossEntryValuationRec(
  curPosition: PositionState,
  curProfit: number,
  curEntryValuation: number,
  step: number,
  precision: number
): number {
  // Only search to precision
  const nextEntryValuation = curEntryValuation + step
  if (Math.abs(nextEntryValuation - curEntryValuation) < precision) return curEntryValuation

  // Simulate the position loss if we move the current exit val in the direction 'step'
  const nextPosition = { ...curPosition, entry: nextEntryValuation }
  const nextOutcome = simulateOutcome(
    nextPosition,
    calcMaxCapitalEfficiency(nextPosition.payoutRange)
  )
  const nextProfit = nextOutcome.profit.marketPosition.amount

  // If we increased decreased profit, continue in the same direction. Otherwise,
  // flip direction and backtrack with half the step
  const nextStep = nextProfit < curProfit ? step : step / -2
  return findMaxLossEntryValuationRec(
    nextPosition,
    nextProfit,
    nextEntryValuation,
    nextStep,
    precision
  )
}

// Find the exit valuation that will lead to a max profit, which is a local minima
function findMaxProfitExitValuationRec(
  curPosition: PositionState,
  curProfit: number,
  curExitValuation: number,
  step: number,
  precision: number
): number {
  // Only search to precision
  const nextExitValuation = curExitValuation + step
  if (Math.abs(nextExitValuation - curExitValuation) < precision) return curExitValuation

  // Simulate the position loss if we move the current exit val in the direction 'step'
  const nextPosition = { ...curPosition, exit: nextExitValuation }
  const nextOutcome = simulateOutcome(
    nextPosition,
    calcMaxCapitalEfficiency(nextPosition.payoutRange)
  )
  const nextProfit = nextOutcome.profit.marketPosition.amount

  // If we increased profit, continue in the same direction. Otherwise,
  // flip direction and backtrack with half the step
  const nextStep = nextProfit > curProfit ? step : step / -2
  return findMaxProfitExitValuationRec(
    nextPosition,
    nextProfit,
    nextExitValuation,
    nextStep,
    precision
  )
}

function getInitialPosition(
  position: PositionState,
  optimisingFor: 'profit' | 'loss'
): PositionState {
  const { market, payoutRange } = position
  if (!market) throw Error('no market in position passed to getMaxLossInitialPosition')
  const { bounds } = market
  // When floor closer to 0 than ceil is to 1, entry valuation in max loss scenario is the
  // ceil, otherwise it is the floor
  // When ceil closer to 1 than floor is to 0, exit valuation in max profit scenario is floor,
  // otherwise it is ceil
  if (
    (optimisingFor === 'loss' && payoutRange.floor < 1 - payoutRange.ceil) ||
    (optimisingFor === 'profit' && payoutRange.floor > 1 - payoutRange.ceil)
  ) {
    return {
      ...position,
      entry: bounds.valuation.ceil,
      exit: bounds.valuation.floor,
      size: 1000,
    }
  }
  return {
    ...position,
    entry: bounds.valuation.floor,
    exit: bounds.valuation.ceil,
    size: 1000,
  }
}

export function deriveMaxProfitLossEntryExitValues(position: PositionState): ScenarioBounds {
  const { market } = position

  if (!market) {
    return {
      maxProfit: [0, 0],
      maxLoss: [0, 0],
    }
  }

  const { bounds } = market

  if (position.type === 'trader') {
    if (position.direction === 'long') {
      return {
        maxProfit: [bounds.valuation.floor, bounds.valuation.ceil],
        maxLoss: [bounds.valuation.ceil, bounds.valuation.floor],
      }
    }
    if (position.direction === 'short') {
      return {
        maxProfit: [bounds.valuation.ceil, bounds.valuation.floor],
        maxLoss: [bounds.valuation.floor, bounds.valuation.ceil],
      }
    }
  }

  // LP
  const initialStep = -(bounds.valuation.ceil - bounds.valuation.floor) / 5
  const precision = calcValuationPrecision(bounds.valuation.floor, bounds.valuation.ceil) / 10

  const maxLossInitialPosition = getInitialPosition(position, 'loss')
  const maxLossInitialOutcome = simulateOutcome(
    maxLossInitialPosition,
    calcMaxCapitalEfficiency(maxLossInitialPosition.payoutRange)
  )
  const maxLossInitialProfit = maxLossInitialOutcome.profit.marketPosition.amount
  const maxLossEntryValuation = findMaxLossEntryValuationRec(
    maxLossInitialPosition,
    maxLossInitialProfit,
    bounds.valuation.ceil,
    initialStep,
    precision
  )

  const maxProfitInitialPosition = getInitialPosition(position, 'profit')
  const maxProfitInitialOutcome = simulateOutcome(
    maxProfitInitialPosition,
    calcMaxCapitalEfficiency(maxProfitInitialPosition.payoutRange)
  )
  const maxProfitInitialProfit = maxProfitInitialOutcome.profit.marketPosition.amount
  const maxProfitExitValuation = findMaxProfitExitValuationRec(
    maxProfitInitialPosition,
    maxProfitInitialProfit,
    bounds.valuation.ceil,
    initialStep,
    precision
  )
  return {
    maxProfit: [
      maxProfitInitialPosition.entry,
      roundValuation(bounds.valuation, maxProfitExitValuation),
    ],
    maxLoss: [roundValuation(bounds.valuation, maxLossEntryValuation), maxLossInitialPosition.exit],
  }
}

export const selectScenarioBounds = createSelector(
  (state: RootState): PositionState => state.position,
  deriveMaxProfitLossEntryExitValues
)
