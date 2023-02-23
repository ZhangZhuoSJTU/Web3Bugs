import { IconName } from 'prepo-ui'
import { PositionType } from '../../utils/prepo.types'

export type BasicTokenInfo = {
  symbol: string
  name: string
}

export type HistoricalEventLongShortToken = {
  id: string
  market: {
    id: string
  }
  token: BasicTokenInfo
}

export type HistoricalEventCollateralToken = {
  id: string
  token: BasicTokenInfo
  baseToken: {
    id: string
    token: BasicTokenInfo
  }
}

export type TransactionBaseType = {
  id: string
  amountUSD: number
  event: string
  createdAtTimestamp: number
  hash: string
  longShortToken: HistoricalEventLongShortToken
  collateralToken: HistoricalEventCollateralToken
}

export type Transaction = TransactionBaseType & {
  action: string
}

export type HistoricalEvent = TransactionBaseType & {
  txCount: number
  transactions: Transaction[]
}

export type HistoricalEvents = {
  historicalEvents: HistoricalEvent[]
}

export type HistoryTransaction = {
  event: string
  eventType?: PositionType
  iconName: IconName
  name: string
  marketId?: string
  usdValue: number
  timestamp: number
  transactionHash: string
}
