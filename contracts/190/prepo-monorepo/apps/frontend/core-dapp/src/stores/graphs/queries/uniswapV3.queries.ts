import gql from 'graphql-tag'
import {
  selectFromPool,
  selectFromPoolDayData,
  selectFromPoolHourData,
} from '../../../../generated/mst-gql/uniswap-v3'

const marketPoolsQuery = selectFromPool()
  .volumeUSD.totalValueLockedUSD.volumeToken0.volumeToken1.totalValueLockedToken0.totalValueLockedToken1.token0(
    (token0) => token0.id
  )
  .token1((token1) => token1.id)

const poolDayDatasQuery =
  selectFromPoolDayData().id.date.liquidity.sqrtPrice.token0Price.token1Price.volumeToken0.volumeToken1.pool(
    (pool) => pool.token0(({ id }) => id).token1(({ id }) => id)
  )

const poolHourDatasQuery =
  selectFromPoolHourData().id.liquidity.periodStartUnix.sqrtPrice.token0Price.token1Price.volumeToken0.volumeToken1.pool(
    (pool) => pool.token0(({ id }) => id).token1(({ id }) => id)
  )

export const latestPoolsDayDatasQueryString = gql`
  query poolsDayDatas($longPoolId: String!, $shortPoolId: String!) {
    longTokenPool: poolDayDatas(
      first: 1
      where: { pool: $longPoolId }
      orderBy: date
      orderDirection: desc
      subgraphError: allow
    ) {
      ${poolDayDatasQuery}
    }
    shortTokenPool: poolDayDatas(
      first: 1
      where: { pool: $shortPoolId }
      orderBy: date
      orderDirection: desc
      subgraphError: allow
    ) {
      ${poolDayDatasQuery}
    }
  }
`

export const latestPoolsHourDatasQueryString = gql`
  query poolsHourDatas($longPoolId: String!, $shortPoolId: String!) {
    longTokenPool: poolHourDatas(
      first: 1
      where: { pool: $longPoolId }
      orderBy: periodStartUnix
      orderDirection: desc
      subgraphError: allow
    ) {
      ${poolHourDatasQuery}
    }
    shortTokenPool: poolHourDatas(
      first: 1
      where: { pool: $shortPoolId }
      orderBy: periodStartUnix
      orderDirection: desc
      subgraphError: allow
    ) {
      ${poolHourDatasQuery}
    }
  }
`

export const poolsDayDatasQueryString = gql`
  query poolsDayDatas($count: Int!, $skip: Int!, $longPoolId: String!, $shortPoolId: String!, $startTime: Int!, $endTime: Int!) {
    longTokenPool: poolDayDatas(
      first: $count
      skip: $skip
      where: { pool: $longPoolId, date_gte: $startTime, date_lte: $endTime }
      orderBy: date
      orderDirection: desc
      subgraphError: allow
    ) {
      ${poolDayDatasQuery}
    }
    shortTokenPool: poolDayDatas(
      first: $count
      skip: $skip
      where: { pool: $shortPoolId, date_gte: $startTime, date_lte: $endTime }
      orderBy: date
      orderDirection: desc
      subgraphError: allow
    ) {
      ${poolDayDatasQuery}
    }
  }
`

export const poolsHourDatasQueryString = gql`
  query poolsHourDatas($count: Int!, $skip: Int!, $longPoolId: String!, $shortPoolId: String!, $startTime: Int!, $endTime: Int!) {
    longTokenPool: poolHourDatas(
      first: $count
      skip: $skip
      orderBy: periodStartUnix
      orderDirection: desc
      subgraphError: allow
      where: { pool: $longPoolId, periodStartUnix_gte: $startTime, periodStartUnix_lte: $endTime }
    ) {
      ${poolHourDatasQuery}
    }
    shortTokenPool: poolHourDatas(
      first: $count
      skip: $skip
      orderBy: periodStartUnix
      orderDirection: desc
      subgraphError: allow
      where: { pool: $shortPoolId, periodStartUnix_gte: $startTime, periodStartUnix_lte: $endTime }
    ) {
      ${poolHourDatasQuery}
    }
  }
`

export const poolsQueryString = gql`
  query pools($longTokenPoolId: String!, $shortTokenPoolId: String!) {
    longTokenPool: pool(id: $longTokenPoolId) {
      ${marketPoolsQuery}
    }
    shortTokenPool: pool(id: $shortTokenPoolId) {
      ${marketPoolsQuery}
    }
  }
`
