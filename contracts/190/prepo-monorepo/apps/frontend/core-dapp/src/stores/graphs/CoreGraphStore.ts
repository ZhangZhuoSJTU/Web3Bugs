import { makeObservable, observable } from 'mobx'
import { GraphStore } from 'prepo-stores'
import { userHistoricalEventsQueryString, userPositionsQueryString } from './queries/core.queries'
import { SupportedContracts } from '../../lib/contract.types'
import { RootStore } from '../RootStore'
import { RootStore as CoreRootStore } from '../../../generated/mst-gql/core-dapp/RootStore'
import { PositionCostBasis } from '../../types/user.types'
import { HistoricalEvents } from '../../features/history/history.types'

export type HistoricalEventsFilter = {
  ownerAddress?: string
  event_in?: string[]
  longShortToken_?: {
    market: string
  }
  createdAtTimestamp_gte?: number
  createdAtTimestamp_lte?: number
}

export class CoreGraphStore extends GraphStore<RootStore, SupportedContracts> {
  constructor(public root: RootStore) {
    super(root, 'core', CoreRootStore)
    makeObservable(this, { positionsCostBasis: observable, historicalEvents: observable })
  }

  positionsCostBasis = (address: string): PositionCostBasis | undefined =>
    this.query<PositionCostBasis>(userPositionsQueryString, { address: address.toLowerCase() })
      ?.data

  historicalEvents = (filter: HistoricalEventsFilter): HistoricalEvents | undefined =>
    this.query<HistoricalEvents>(userHistoricalEventsQueryString, {
      filter,
    })?.data
}
