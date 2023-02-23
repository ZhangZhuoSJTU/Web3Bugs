import { DocumentNode } from 'graphql'
import { Query, QueryOptions as MQueryOptions } from 'mst-gql'

export type OnNewDataOptions = {
  count: number
  skip: number
}

export type OnNewDataOutput<TData = unknown> = {
  data?: TData
  allFound: boolean
}

export type QueryOptions = {
  refetchInterval?: number
  stopRefetch?: boolean
} & MQueryOptions

export type QueryFunction = <TData = unknown, TVariables = unknown>(
  gqlQuery: string | DocumentNode,
  variables?: TVariables,
  options?: QueryOptions
) => Query<TData>

export type ContinuousQueryOptions<TData = unknown> = {
  maxDataPerFetch?: number
  onNewData?: (current: TData, newData: TData, options: OnNewDataOptions) => OnNewDataOutput<TData>
}

export type ContinuousQueryOutput<TData = unknown> = Partial<Pick<Query<TData>, 'data' | 'error'>>
