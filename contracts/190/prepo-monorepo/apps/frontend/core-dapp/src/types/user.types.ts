import { SupportedCurrencies } from './currency.types'

export type User = {
  balances: {
    [key in SupportedCurrencies]?: number
  }
}

export type Position = {
  id: string
  costBasis: number
  ownerAddress: string
  longShortToken: {
    id: string
  }
}

export type PositionCostBasis = {
  positions: Position[]
}
