import { createSelector } from '@reduxjs/toolkit'
import { SimulationTool } from 'prepo-sdk'
import { Periods, PositionState } from './position-slice'
import {
  calcMaxCapitalEfficiency,
  selectMaxCapitalEfficiency,
} from './max-capital-efficiency-selector'
import { checkValuationRangeValid, valuationToLongPrice } from '../../helpers'
import { RootState } from '../../app/store'

const { Market, Actor } = SimulationTool

type Delta = { amount: number; percent: number }

export interface Outcome {
  deposited: number
  withdrawn: number
  profit: {
    marketPosition: Delta
    swapFee: Delta
    total: Delta
  }
  rewards: {
    collateralFarming: Delta
    ppo: Delta
    total: Delta
  }
  fees: {
    mint: number
    redeem: number
  }
  netProfitLoss: Delta
}

const zeroOutcome: Outcome = {
  deposited: 0,
  withdrawn: 0,
  profit: {
    marketPosition: {
      amount: 0,
      percent: 0,
    },
    swapFee: {
      amount: 0,
      percent: 0,
    },
    total: {
      amount: 0,
      percent: 0,
    },
  },
  fees: {
    mint: 0,
    redeem: 0,
  },
  rewards: {
    collateralFarming: { amount: 0, percent: 0 },
    ppo: { amount: 0, percent: 0 },
    total: { amount: 0, percent: 0 },
  },
  netProfitLoss: { amount: 0, percent: 0 },
}

function holdingPeriodToYears(unit: keyof Periods, val: number): number {
  if (Number.isNaN(val)) return 0
  if (unit === 'Y') return val
  if (unit === 'M') return val / 12
  return val / 365
}

export function simulateOutcome(position: PositionState, maxCapitalEfficiency: number): Outcome {
  const { fees, market: positionMarket, holdingPeriod, capitalEfficiency } = position

  if (!positionMarket) {
    return zeroOutcome
  }

  const { bounds } = positionMarket
  if (
    position.size === 0 ||
    Number.isNaN(position.size) ||
    position.entry === null ||
    position.exit === null ||
    position.entry > bounds.valuation.ceil ||
    position.exit > bounds.valuation.ceil ||
    position.entry < bounds.valuation.floor ||
    position.exit < bounds.valuation.floor ||
    position.capitalEfficiency === 0 ||
    !checkValuationRangeValid(positionMarket.bounds.valuation)
  )
    return zeroOutcome

  // Simulate market
  const yearsHeld = holdingPeriodToYears(holdingPeriod.unit, holdingPeriod.num)
  const lp = new Actor('lp', Number.MAX_SAFE_INTEGER)
  const user = new Actor('user', position.size)
  const counterparty = new Actor('counterparty', Number.MAX_SAFE_INTEGER)
  const lpSize = 1000000000
  const market = new Market(
    'simulated-market',
    {
      bounds: position.payoutRange,
      fee: 0,
      protocolFee: 0,
    },
    lpSize,
    lp
  )
  const entryLongPrice = valuationToLongPrice(
    bounds.valuation,
    position.payoutRange,
    position.entry
  )
  const exitLongPrice = valuationToLongPrice(bounds.valuation, position.payoutRange, position.exit)

  // Work out mint fee
  const mintFee = position.size * fees.mint
  const sizeAfterDepositFee = position.size - mintFee
  // Work out amount withheld (if LP with less than max capital efficiency)
  const withheldAmount =
    position.type === 'lp'
      ? sizeAfterDepositFee - (capitalEfficiency / maxCapitalEfficiency) * sizeAfterDepositFee
      : 0

  const sizeAfterWithheldAmount = sizeAfterDepositFee - withheldAmount

  // Trade market/s to entry price, open position/s, trade market/s to exit
  market.tradeToTargetPrice(counterparty, entryLongPrice)
  if (position.type === 'trader' && position.direction) {
    market.openPosition(user, position.direction, sizeAfterDepositFee)
  } else {
    market.deposit(user, sizeAfterWithheldAmount)
  }
  market.tradeToTargetPrice(counterparty, exitLongPrice)
  // Get position profit
  const positionProfit = market.getActorNetProfit(user)
  // Get position size after position profit
  const sizeAfterPositionProfit = market.getActorNetWorth(user)
  // Get swap fee profit
  let swapFeeProfit = 0
  if (position.type === 'lp') {
    swapFeeProfit =
      ((position.size - withheldAmount + sizeAfterPositionProfit) / 2) *
      position.swapFeeApy *
      yearsHeld
  }
  const sizeAfterSwapFeeProfit = sizeAfterPositionProfit + swapFeeProfit
  // Get PPO reward amount for holding the position position
  const ppoReward = sizeAfterSwapFeeProfit * position.rewards.ppo
  // Put withheld amount back into amount now that we're about to withdraw pool
  const sizeIncludingWithheldAmount = sizeAfterSwapFeeProfit + withheldAmount
  // Get redeem fee
  const redeemFee = sizeIncludingWithheldAmount * fees.redeem
  // Get position size after redeem fee
  const sizeAfterRedeemFee = sizeIncludingWithheldAmount - redeemFee
  // Get collateral farming reward
  const collateralFarmingReward = sizeAfterRedeemFee * position.rewards.collateralFarming
  // Get final withdrawn amount
  const withdrawn = sizeAfterRedeemFee + collateralFarmingReward + ppoReward

  // Total fees
  const totalFees = mintFee + redeemFee

  return {
    deposited: position.size,
    withdrawn,
    profit: {
      marketPosition: {
        amount: positionProfit.amount,
        percent: positionProfit.amount / sizeAfterDepositFee,
      },
      swapFee: {
        amount: swapFeeProfit,
        percent: swapFeeProfit / position.size,
      },
      total: {
        amount: positionProfit.amount + swapFeeProfit - totalFees,
        percent: (positionProfit.amount + swapFeeProfit - totalFees) / position.size,
      },
    },
    fees: {
      mint: mintFee,
      redeem: redeemFee,
    },
    rewards: {
      collateralFarming: {
        amount: collateralFarmingReward,
        percent: collateralFarmingReward / position.size,
      },
      ppo: { amount: ppoReward, percent: ppoReward / position.size },
      total: {
        amount: collateralFarmingReward + ppoReward,
        percent: (collateralFarmingReward + ppoReward) / position.size,
      },
    },
    netProfitLoss: {
      amount: withdrawn - position.size,
      percent: (withdrawn - position.size) / position.size,
    },
  }
}

export const selectOutcome = createSelector(
  (state: RootState): PositionState => state.position,
  selectMaxCapitalEfficiency,
  simulateOutcome
)

export const selectNonZeroOutcome = createSelector(
  (state: RootState): PositionState => state.position,
  selectOutcome,
  (position: PositionState, outcome: Outcome): Outcome => {
    if (position.size > 0) return outcome
    const nonZeroPosition = {
      ...position,
      size: 1000,
    }
    return simulateOutcome(nonZeroPosition, calcMaxCapitalEfficiency(nonZeroPosition.payoutRange))
  }
)
