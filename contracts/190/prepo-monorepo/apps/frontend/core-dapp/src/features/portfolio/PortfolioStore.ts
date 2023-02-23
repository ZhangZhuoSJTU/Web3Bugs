import { BigNumber } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import { action, makeAutoObservable } from 'mobx'
import { ERC20_UNITS } from '../../lib/constants'
import { supportedMarkets } from '../../lib/markets-contracts'
import { Erc20Store } from '../../stores/entities/Erc20.entity'
import { MarketEntity } from '../../stores/entities/MarketEntity'
import { HistoricalEventsFilter } from '../../stores/graphs/CoreGraphStore'
import { RootStore } from '../../stores/RootStore'
import { Position as PositionFromGraph } from '../../types/user.types'
import { normalizeDecimalPrecision } from '../../utils/number-utils'
import { PositionType } from '../../utils/prepo.types'
import {
  formatHistoricalEvent,
  KNOWN_HISTORY_EVENTS,
  KNOWN_HISTORY_EVENTS_MAP,
} from '../history/history-utils'
import { HistoryTransaction } from '../history/history.types'
import { Direction } from '../trade/TradeStore'

export type Position = {
  market: MarketEntity
  position: PositionType
  data?: {
    costBasis?: number
    price: number
    priceBN: BigNumber
    pnl?: number
    percentage?: number
    token: Erc20Store
    tokenBalance: string
    totalValue: string
    totalValueBN: BigNumber
    decimals: number
  }
}

export class PortfolioStore {
  selectedPosition?: Required<Position>

  constructor(public root: RootStore) {
    makeAutoObservable(this, {
      setSelectedPosition: action.bound,
    })
  }

  setSelectedPosition(position?: Required<Position>): void {
    this.selectedPosition = position
  }

  hasPosition(market: MarketEntity, direction: Direction): Position | undefined {
    const token = market[`${direction}Token`]
    const tokenBalance = market[`${direction}TokenBalance`]
    const tokenBalanceBN = market[`${direction}TokenBalanceBN`]
    const price = market[`${direction}TokenPrice`]
    const defaultValue = { market, position: direction }

    const loading =
      !token ||
      token.decimalsNumber === undefined ||
      tokenBalance === undefined ||
      tokenBalanceBN === undefined ||
      price === undefined
    if (loading) return defaultValue

    const noPosition = tokenBalanceBN.lte(BigNumber.from(10))
    if (noPosition) return undefined

    const priceBN = parseUnits(`${price}`, ERC20_UNITS)
    const totalValueBN = tokenBalanceBN.mul(priceBN).div(BigNumber.from(10).pow(ERC20_UNITS))
    const totalValue = token.formatUnits(totalValueBN)
    if (totalValueBN.eq(0) || totalValue === undefined) return undefined

    let costBasis
    let pnl
    let percentage
    if (this.signerCostBasis) {
      const foundPosition = this.signerCostBasis.find(
        ({ longShortToken: { id } }) => id === token.address?.toLowerCase()
      )
      if (foundPosition) {
        costBasis = foundPosition.costBasis
        // pnl is just an estimation so it doesn't require BigNumber level accuracy
        pnl = +tokenBalance * (price - costBasis)
        const capital = +totalValue - pnl
        if (pnl > 0) percentage = pnl / capital
      }
    }

    const returnValue = {
      data: {
        costBasis,
        pnl,
        percentage,
        price,
        priceBN,
        token,
        tokenBalance,
        totalValue,
        totalValueBN,
        decimals: token.decimalsNumber,
      },
      ...defaultValue,
    }

    return returnValue
  }

  get historicalEvents(): HistoryTransaction[] | undefined {
    const { address, network } = this.root.web3Store
    if (!address) return []

    return formatHistoricalEvent(
      this.root.coreGraphStore.historicalEvents(this.historyFilter)?.historicalEvents,
      network.name
    )
  }

  get historyFilter(): HistoricalEventsFilter {
    const { address, network } = this.root.web3Store
    const {
      currentFilter: {
        selectedFilterTypes,
        selectedMarket,
        confirmedDateRange: { end, start },
      },
    } = this.root.filterStore

    // only query subgraph is all selected types are valid event
    const validatedTypes =
      selectedFilterTypes?.filter((key) => KNOWN_HISTORY_EVENTS_MAP[key] !== undefined) ?? []

    const types =
      !selectedFilterTypes || validatedTypes.length === 0
        ? Object.keys(KNOWN_HISTORY_EVENTS)
        : validatedTypes.map((key) => KNOWN_HISTORY_EVENTS_MAP[key])
    const marketAddressName =
      typeof selectedMarket === 'object' ? selectedMarket.address : undefined
    const marketMap = marketAddressName ? supportedMarkets[marketAddressName] : undefined
    const market = marketMap ? marketMap[network.name]?.toLocaleLowerCase() : undefined
    return {
      ownerAddress: address?.toLowerCase(),
      event_in: types,
      longShortToken_: market ? { market } : undefined,
      createdAtTimestamp_gte: start ? Math.floor(start.getTime() / 1000) : undefined,
      createdAtTimestamp_lte: end ? Math.floor(end.getTime() / 1000) : undefined,
    }
  }

  get tradingPositions(): Position[] {
    const { marketStore } = this.root
    const { markets } = marketStore

    const positions: Position[] = []
    Object.values(markets).forEach((market) => {
      const longPosition = this.hasPosition(market, 'long')
      const shortPosition = this.hasPosition(market, 'short')

      if (longPosition) positions.push(longPosition)
      if (shortPosition) positions.push(shortPosition)
    })

    return positions
  }

  get positions(): Position[] {
    return [...this.tradingPositions]
  }

  get portfolioValue(): string | undefined {
    const { preCTTokenStore } = this.root
    if (
      this.tradingPositionsValue === undefined ||
      preCTTokenStore.tokenBalanceFormat === undefined
    )
      return undefined

    const tokenBalance = Number(preCTTokenStore.tokenBalanceFormat)
    const tradingPositionsAndBalance = Number(this.tradingPositionsValue) + tokenBalance

    if (Number.isNaN(tradingPositionsAndBalance)) return undefined

    return `${tradingPositionsAndBalance}`
  }

  get signerCostBasis(): PositionFromGraph[] | undefined {
    const { address } = this.root.web3Store
    if (!address) return []
    const output = this.root.coreGraphStore.positionsCostBasis(address)

    return output?.positions
  }

  get tradingPositionsValue(): number | undefined {
    if (this.positions === undefined) return undefined
    let valueSum = 0
    let minLoaded = false
    this.positions.forEach(({ data }) => {
      if (data) {
        minLoaded = true
        valueSum += Number(normalizeDecimalPrecision(`${data.totalValue}`))
      }
    })
    return minLoaded || this.positions.length === 0 ? valueSum : undefined
  }
}
