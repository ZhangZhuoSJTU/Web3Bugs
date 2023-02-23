import { autorun, makeAutoObservable, reaction, runInAction } from 'mobx'
import gql from 'graphql-tag'
import { createHttpClient, Query } from 'mst-gql'
import { SupportedNetworks } from 'prepo-constants'
import { DocumentNode } from 'graphql'
import { RootStore } from './RootStore'
import {
  RootStoreType as UniswapV3RootStoreType,
  RootStore as UniswapV3RootStore,
  SwapModelType,
  PoolModelType,
} from '../../generated/mst-gql/uniswap-v3'
import { selectFromTransaction } from '../../generated/mst-gql/uniswap-v3/TransactionModel.base'
import { selectFromPool } from '../../generated/mst-gql/uniswap-v3/PoolModel.base'
import { selectFromSwap } from '../../generated/mst-gql/uniswap-v3/SwapModel.base'
import { selectFromToken } from '../../generated/mst-gql/uniswap-v3/TokenModel.base'

type Endpoints = {
  [Property in SupportedNetworks]?: string
}

// Using mainnet on goerli because this subgraph is not deployed on testnets
const endpoints: Endpoints = {
  mainnet: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  goerli: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
}

// Create a custom query that fetches
// - the last 5 swaps made from the signer address
// - the 100 highest volume pools
const buildCustomQuery = (address: string): DocumentNode => gql`
  {
    swaps(
      first: 5
      orderBy: timestamp
      orderDirection: desc
      where: { origin: "${address}" }
    ) {
      ${selectFromSwap()
        .id.origin.recipient.amountUSD.transaction(selectFromTransaction().id.blockNumber)
        .token0(selectFromToken().symbol)
        .token1(selectFromToken().symbol)}
    }

    pools(first: 100, orderBy: volumeUSD, orderDirection: desc) {
      ${selectFromPool()
        .id.volumeUSD.feesUSD.totalValueLockedUSD.feeTier.token0(selectFromToken().symbol)
        .token1(selectFromToken().symbol)}
    }
  }
`

// Specify the shape of the response of the custom query
type CustomQueryType = {
  swaps: SwapModelType[]
  pools: PoolModelType[]
}

class UniswapV3GraphStore {
  root: RootStore
  graph: UniswapV3RootStoreType | undefined
  customQuery: Query<CustomQueryType> | undefined

  constructor(root: RootStore) {
    this.root = root
    makeAutoObservable(this, {}, { autoBind: true })
    this.init()
  }

  init(): void {
    // Tear down and create new client when network changes
    autorun(() => {
      const network = this.root.web3Store.network.name
      const endpoint = endpoints[network]
      if (typeof endpoint === 'undefined')
        throw Error(`no endpoint for graphql endpoint on ${network}`)
      this.graph = UniswapV3RootStore.create(undefined, {
        gqlHttpClient: createHttpClient(endpoint),
      })
    })

    // Set this.customQuery and keep it up to date when dependencies change
    autorun(() => {
      if (
        !this.root.web3Store.blockNumber ||
        !this.root.web3Store.signerState.address ||
        !this.graph
      )
        return

      const { address } = this.root.web3Store.signerState
      runInAction(() => {
        if (!this.graph) return
        this.customQuery = this.graph.query(buildCustomQuery(address), {
          // Set fetchPolicy so accessing this query only fetches data from the network
          // if there is nothing in the cache. this is so we only make new network requests
          // when there are new blocks.
          // https://github.com/mobxjs/mst-gql#query-caching
          fetchPolicy: 'cache-first',
        })
      })
    })

    // Explicitly refetch customQuery data cache when there is a new block
    // NOTE: an alternative approach could be to split up customQuery
    // into two queries (one for swaps, one for pools), and refetch pools
    // on a longer interval because it is larger.
    reaction(
      () => this.customQuery && this.root.web3Store.blockNumber,
      () => this.customQuery?.refetch()
    )
  }
}

export default UniswapV3GraphStore
