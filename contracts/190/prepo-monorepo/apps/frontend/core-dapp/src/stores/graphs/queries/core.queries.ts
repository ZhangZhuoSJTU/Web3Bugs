import gql from 'graphql-tag'
import {
  selectFromHistoricalEvent,
  selectFromPosition,
} from '../../../../generated/mst-gql/core-dapp'

export const userPositionsQueryString = gql`
  query userPositions($address: String!) {
    positions(where: { ownerAddress: $address }) {
        ${selectFromPosition().id.costBasis.ownerAddress.longShortToken(({ id }) => id)}
    }
  }
`

export const userHistoricalEventsQueryString = gql`
  query userHistoricalEvents($filter: HistoricalEvent_filter!) {
    historicalEvents(where: $filter, orderBy: createdAtTimestamp, orderDirection: desc) {
      ${selectFromHistoricalEvent()
        .id.amountUSD.createdAtTimestamp.event.hash.txCount.longShortToken(({ id }) =>
          id.market(undefined).token(({ name }) => name.id.symbol)
        )
        .collateralToken(({ id }) =>
          id
            .token(({ name }) => name.id.symbol)
            .baseToken((baseToken) => baseToken.token((token) => token.id.name.symbol))
        )
        .transactions((transaction) =>
          transaction.id.amountUSD.action.createdAtTimestamp.event.hash
            .collateralToken(({ id }) =>
              id.baseToken(undefined).token(({ name }) => name.id.symbol)
            )
            .longShortToken(({ id }) => id.market(undefined).token(({ name }) => name.id.symbol))
        )}
    }
  }
`
