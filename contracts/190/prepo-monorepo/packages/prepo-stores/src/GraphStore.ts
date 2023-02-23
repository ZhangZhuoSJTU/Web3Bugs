import { GRAPH_ENDPOINTS, SupportedGraphs } from 'prepo-constants'
import { createHttpClient, Query, MSTGQLStore } from 'mst-gql'
import { Instance } from 'mobx-state-tree'
import { action, autorun, makeObservable, observable, reaction, runInAction } from 'mobx'
import { DocumentNode } from 'graphql'
import { RootStore } from './RootStore'
import { Storage } from './utils/stores.types'
import { getQueryString } from './utils/graph-store-utils'
import {
  ContinuousQueryOptions,
  ContinuousQueryOutput,
  QueryOptions,
} from './utils/graph-store.types'

type StorageQuery = {
  refetchInterval?: number
  lastRefetch?: number
  query: Query
  stopRefetch: boolean
}

function isContinuousQuery<T>(value: ContinuousQueryOutput): value is ContinuousQueryOutput<T> {
  return value !== undefined
}

export class GraphStore<RootStoreType, SupportedContracts> {
  continuousQueryStorage: Storage<ContinuousQueryOutput>
  graphName: SupportedGraphs
  graph?: Instance<typeof MSTGQLStore.Type>
  graphRootStore: typeof MSTGQLStore
  root: RootStore<SupportedContracts> & RootStoreType
  storage: Storage<StorageQuery>
  constructor(
    root: RootStore<SupportedContracts> & RootStoreType,
    graphName: SupportedGraphs,
    graphRootStore: typeof MSTGQLStore
  ) {
    this.continuousQueryStorage = {}
    this.graph = undefined
    this.graphName = graphName
    this.graphRootStore = graphRootStore
    this.root = root
    this.storage = {}

    makeObservable(
      this,
      {
        graph: observable,
        query: observable,
        continuousQuery: observable,
        continuousQueryStorage: observable,
        onBlockChange: action.bound,
        storage: observable,
      },
      { autoBind: true }
    )
    this.init()
    this.handleRefetch()
  }

  private init(): void {
    autorun(() => {
      const network = this.root.web3Store.network.name
      const httpEndpoint = GRAPH_ENDPOINTS[this.graphName][network]
      if (httpEndpoint === undefined)
        throw Error(`No graphql endpoint for ${this.graphName} on ${network}`)

      this.graph = this.graphRootStore.create(undefined, {
        gqlHttpClient: createHttpClient(httpEndpoint),
      })
    })
  }

  private handleRefetch(): void {
    reaction(() => this.root.web3Store.blockNumber, this.onBlockChange)
  }

  onBlockChange(blockNumber?: number): void {
    if (blockNumber === undefined) {
      return
    }
    Object.entries(this.storage).forEach(([queryString, varStrings]) => {
      Object.entries(varStrings).forEach(
        ([varString, { refetchInterval, lastRefetch, query, stopRefetch }]) => {
          if (lastRefetch === undefined) {
            runInAction(() => {
              // if lastRefetch is undefined, this is a new query
              // give it a blockNumber of -1 because it's was already fetched when being created
              // during previous block
              this.storage[queryString][varString].lastRefetch = blockNumber - 1
            })
          } else if ((refetchInterval ?? 1) + lastRefetch <= blockNumber && !stopRefetch) {
            query.refetch()
          }
        }
      )
    })
  }

  query<TData = unknown, TVariables = unknown>(
    gqlQuery: string | DocumentNode,
    variables?: TVariables,
    options: QueryOptions = { fetchPolicy: 'cache-first', refetchInterval: 1 }
  ): Query<TData> | undefined {
    try {
      if (!this.graph) return undefined
      const queryString = getQueryString(gqlQuery)
      const varString = JSON.stringify(variables)
      let { refetchInterval = 1, stopRefetch = false } = options
      refetchInterval = refetchInterval <= 0 ? 1 : refetchInterval
      stopRefetch = stopRefetch ?? false

      runInAction(() => {
        if (!this.storage[queryString]) this.storage[queryString] = {}
      })

      // If cached, handle refetchInterval change, then return cached
      const cur = this.storage[queryString][varString]
      if (cur !== undefined) {
        runInAction(() => {
          // sync custom options
          this.storage[queryString][varString].refetchInterval = refetchInterval
          this.storage[queryString][varString].stopRefetch = stopRefetch
        })
        return cur.query as Query<TData>
      }

      runInAction(() => {
        if (!this.graph) return
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        const query = this.graph.query<TData>(gqlQuery, variables, options)
        this.storage[queryString][varString] = {
          refetchInterval,
          stopRefetch,
          query,
        }
      })
      return this.storage[queryString][varString].query as Query<TData>
    } catch (error) {
      throw this.root.captureError(error)
    }
  }

  continuousQuery<TData = unknown, TVariables = unknown>(
    query: string | DocumentNode,
    variables: TVariables,
    options: ContinuousQueryOptions<TData>
  ): ContinuousQueryOutput<TData> | undefined {
    try {
      const queryString = getQueryString(query)
      const varString = JSON.stringify(variables)
      const { maxDataPerFetch, onNewData } = options

      runInAction(() => {
        if (!this.continuousQueryStorage[queryString]) this.continuousQueryStorage[queryString] = {}
      })

      // If cached, return this so we never go through the while loop again
      // when new data is fetched, we can update the storage to get new data
      const cur = this.continuousQueryStorage[queryString][varString]

      if (isContinuousQuery<TData>(cur)) return cur

      let allFound = false
      const count = maxDataPerFetch || 1000
      let data: TData
      let skip = 0
      while (!allFound && onNewData) {
        const queryObj = this.query<TData, TVariables & { count: number; skip: number }>(
          query,
          { ...variables, count, skip },
          { stopRefetch: true }
        )
        // error and loading handling
        if (queryObj?.error) throw queryObj.error
        if (queryObj?.data === undefined) return {}

        // allow caller to control whether the loop will continue
        // this allow more flexibility, so we can query multiple stuffs within the same query
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const output = onNewData(data, queryObj.data, { count, skip })
        skip += count
        data = output.data as TData
        allFound = output.allFound
      }

      runInAction(() => {
        this.continuousQueryStorage[queryString][varString] = {
          data,
        }
      })

      return undefined
    } catch (error) {
      return {
        error: this.root.captureError(error),
      }
    }
  }
}
