import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Literal, Union, Static } from 'runtypes'
import markets, { Market, MarketName, MarketType, Bounds } from './markets'
import { calcMaxCapitalEfficiency } from './max-capital-efficiency-selector'
import { deriveMaxProfitLossEntryExitValues } from './scenario-bounds-selector'
import { forceNumInRange } from '../../helpers'

export const TraderType = Union(Literal('trader'), Literal('lp'))
export type Type = Static<typeof TraderType>

export const DirectionType = Union(Literal('long'), Literal('short'))
export type Direction = Static<typeof DirectionType>

export type PositionAccordionState = 'open' | 'closed'

export type Mode = 'basic' | 'advanced'

type UI = {
  positionAccordionSettingsState: PositionAccordionState
  positionAcordionEntryExitState: PositionAccordionState
  positionSettingsCompleted: boolean
  scrollToMarket: boolean
  hasCompletedPositionSettings: boolean
  hasCompletedEntryExit: boolean
  hasEnteredDepositAmount: boolean
  editingPositionTable: boolean
  editingRewardsTable: boolean
  marketType: MarketType
  mode: Mode
}

export interface Periods {
  Y: 'years'
  M: 'months'
  D: 'days'
}
export const periods: Periods = {
  Y: 'years',
  M: 'months',
  D: 'days',
}

export interface PositionState {
  type: Type | null
  direction: Direction | null
  market: Market | null
  size: number
  swapFeeApy: number
  rewards: {
    collateralFarming: number
    ppo: number
  }
  fees: {
    mint: number
    redeem: number
  }
  holdingPeriod: {
    unit: keyof Periods
    num: number
  }
  payoutRange: Bounds
  entry: number
  exit: number
  capitalEfficiency: number
  ui: UI
}

const initialPayoutRange = { floor: 0.2, ceil: 0.8 }
const initialState: PositionState = {
  type: null,
  direction: null,
  market: null,
  size: 0,
  swapFeeApy: 0.25,
  rewards: {
    collateralFarming: 0.15,
    ppo: 1.1,
  },
  fees: {
    mint: 0.005,
    redeem: 0.005,
  },
  holdingPeriod: {
    unit: 'Y',
    num: 1,
  },
  entry: 0,
  exit: 0,
  capitalEfficiency: calcMaxCapitalEfficiency(initialPayoutRange),
  payoutRange: initialPayoutRange,
  ui: {
    positionAccordionSettingsState: 'open',
    positionAcordionEntryExitState: 'open',
    positionSettingsCompleted: false,
    scrollToMarket: false,
    hasCompletedPositionSettings: false,
    hasCompletedEntryExit: false,
    hasEnteredDepositAmount: false,
    editingPositionTable: false,
    editingRewardsTable: false,
    marketType: 'preipo',
    mode: 'basic',
  },
}

const maxPeriods = {
  Y: 5,
  M: 36,
  D: 730,
}

const positionSlice = createSlice({
  name: 'position',
  initialState,
  reducers: {
    modeChanged(state, action: PayloadAction<Mode>) {
      state.ui.mode = action.payload
      // If advanced select custom market, otherwise select the default pre ipo market
      const nextType = action.payload === 'advanced' ? 'custom' : 'preipo'
      state.ui.marketType = nextType
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const [, market] = [...markets].find(([, _market]) => _market.type === nextType) as [
        MarketName,
        Market
      ]
      state.market = market
      const [entry, exit] = deriveMaxProfitLossEntryExitValues(state).maxProfit
      state.entry = entry
      state.exit = exit
    },
    typeChanged(state, action: PayloadAction<Type>) {
      state.type = action.payload
    },
    sizeChanged(state, action: PayloadAction<number>) {
      state.size = action.payload
    },
    directionChanged(state, action: PayloadAction<Direction>) {
      state.direction = action.payload
    },
    setCompletePositionSettings(state, action: PayloadAction<boolean>) {
      state.ui.positionSettingsCompleted = action.payload
    },
    marketChanged(state, action: PayloadAction<MarketName>) {
      const market = markets.get(action.payload)
      if (market) {
        state.market = market
        const [entry, exit] = deriveMaxProfitLossEntryExitValues(state).maxProfit
        state.entry = entry
        state.exit = exit
      } else {
        throw Error(`market ${action.payload} not found`)
      }
    },
    entryChanged(state, action: PayloadAction<number>) {
      state.entry = action.payload
    },
    entryAndExitChanged(state, { payload }: PayloadAction<[number, number]>) {
      const [entry, exit] = payload
      state.entry = entry
      state.exit = exit
    },
    payoutRangeChanged(state, { payload }: PayloadAction<[number, number]>) {
      const [floor, ceil] = payload
      state.payoutRange.floor = floor
      state.payoutRange.ceil = ceil
    },
    setScrollToMarket(state, action: PayloadAction<boolean>) {
      state.ui.scrollToMarket = action.payload
    },
    exitChanged(state, action: PayloadAction<number>) {
      state.exit = action.payload
    },
    collateralFarmingApyChanged(state, action: PayloadAction<number>) {
      state.rewards.collateralFarming = action.payload
    },
    ppoApyChanged(state, action: PayloadAction<number>) {
      state.rewards.ppo = action.payload
    },
    mintFeeChanged(state, action: PayloadAction<number>) {
      state.fees.mint = action.payload
    },
    redeemFeeChanged(state, action: PayloadAction<number>) {
      state.fees.redeem = action.payload
    },
    swapFeeApyChanged(state, action: PayloadAction<number>) {
      state.swapFeeApy = action.payload
    },
    positionSettingsCompleted(state) {
      state.ui.hasCompletedPositionSettings = true
    },
    entryExitCompleted(state) {
      state.ui.hasCompletedEntryExit = true
    },
    enteredDepositAmount(state) {
      state.ui.hasEnteredDepositAmount = true
    },
    positionAccordionStateChanged(state, action: PayloadAction<PositionAccordionState>) {
      state.ui.positionAccordionSettingsState = action.payload
    },
    positionAccordionEntryExitStateChanged(state, action: PayloadAction<PositionAccordionState>) {
      state.ui.positionAcordionEntryExitState = action.payload
    },
    holdingPeriodNumChanged(state, action: PayloadAction<number>) {
      state.holdingPeriod.num = Math.max(
        1,
        Math.min(maxPeriods[state.holdingPeriod.unit], action.payload)
      )
    },
    holdingPeriodUnitChanged(state, action: PayloadAction<keyof Periods>) {
      const nextPeriod = action.payload
      const lastPeriod = state.holdingPeriod.unit
      if (nextPeriod === 'Y' && lastPeriod === 'M') {
        state.holdingPeriod.num = Math.min(
          maxPeriods.Y,
          Math.max(1, Math.round(state.holdingPeriod.num / 12))
        )
      }
      if (nextPeriod === 'Y' && lastPeriod === 'D') {
        state.holdingPeriod.num = Math.min(
          maxPeriods.Y,
          Math.max(1, Math.round(state.holdingPeriod.num / 365))
        )
      }
      if (nextPeriod === 'M' && lastPeriod === 'Y') {
        state.holdingPeriod.num = Math.min(
          maxPeriods.M,
          Math.max(1, Math.round(state.holdingPeriod.num * 12))
        )
      }
      if (nextPeriod === 'M' && lastPeriod === 'D') {
        state.holdingPeriod.num = Math.min(
          maxPeriods.M,
          Math.max(1, Math.round(state.holdingPeriod.num / 30.417))
        )
      }
      if (nextPeriod === 'D' && lastPeriod === 'Y') {
        state.holdingPeriod.num = Math.min(
          maxPeriods.D,
          Math.max(1, Math.round(state.holdingPeriod.num * 365))
        )
      }
      if (nextPeriod === 'D' && lastPeriod === 'M') {
        state.holdingPeriod.num = Math.min(
          maxPeriods.D,
          Math.max(1, Math.round(state.holdingPeriod.num * 30.417))
        )
      }
      state.holdingPeriod.unit = nextPeriod
    },
    setEditingPositionTable(state, action: PayloadAction<boolean>) {
      state.ui.editingPositionTable = action.payload
    },
    setEditingRewardsTable(state, action: PayloadAction<boolean>) {
      state.ui.editingRewardsTable = action.payload
    },
    marketTypeChanged(state, action: PayloadAction<MarketType>) {
      state.market = null // Resets market selection
      const [entry, exit] = deriveMaxProfitLossEntryExitValues(state).maxProfit
      state.entry = entry
      state.exit = exit
      state.ui.marketType = action.payload
    },
    capitalEfficiencyChanged(state, action: PayloadAction<number>) {
      state.capitalEfficiency = action.payload
    },
    marketValuationRangeChanged(state, action: PayloadAction<Bounds>) {
      if (state.market) {
        state.market.bounds.valuation = action.payload
        const { floor, ceil } = action.payload
        state.entry = forceNumInRange(state.entry, floor, ceil)
        state.exit = forceNumInRange(state.exit, floor, ceil)
      }
    },
    reset() {
      return initialState
    },
  },
})

export const { actions } = positionSlice
export default positionSlice.reducer
