import { Color } from 'styled-components'

export enum PpoHistoryEnum {
  BONDING = 'Bonding',
  LIQUIDITY = 'LP Rewards',
  GOVERNANCE = 'Governance',
  STAKING = 'Staking',
  TRADING_REWARDS = 'Trading Rewards',
}

export type PpoEventColors = {
  accent: keyof Color
  primary: keyof Color
}

export type PpoEventObject = {
  [key in PpoHistoryEnum]: {
    label: PpoHistoryEnum
    colors: PpoEventColors
  }
}

export type PpoHistoryItem = {
  amount: number
  amountUsd: string
  timestamp: number
  type: PpoHistoryEnum
}

export const ppoHistoryFilterTypes = [
  PpoHistoryEnum.STAKING,
  PpoHistoryEnum.GOVERNANCE,
  PpoHistoryEnum.TRADING_REWARDS,
  PpoHistoryEnum.LIQUIDITY,
  PpoHistoryEnum.BONDING,
]
