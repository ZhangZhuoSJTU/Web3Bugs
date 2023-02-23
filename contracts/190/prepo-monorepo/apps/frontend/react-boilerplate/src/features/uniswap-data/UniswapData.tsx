import { observer } from 'mobx-react-lite'
import { Table } from 'antd'
import styled from 'styled-components'
import { formatNumber } from 'prepo-utils'
import { useRootStore } from '../../context/RootStoreProvider'
import { spacingIncrement } from '../../utils/theme/utils'
import Heading from '../../components/Heading'

const Wrapper = styled.div`
  align-items: center;
  background-color: ${({ theme }): string => theme.color.secondaryBackground};
  border-radius: ${({ theme }): string => `${theme.borderRadius * 2}px`};
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  margin-top: ${spacingIncrement(32)};
  padding: ${spacingIncrement(80)} 0;
  width: 90%;
`

const Title = styled(Heading)`
  margin-bottom: ${spacingIncrement(32)};
`

const swapColumns = [
  {
    title: 'Token In',
    dataIndex: 'tokenIn',
    key: 'tokenIn',
  },
  {
    title: 'Token Out',
    dataIndex: 'tokenOut',
    key: 'tokenOut',
  },
  {
    title: 'Amount USD',
    dataIndex: 'amountUSD',
    key: 'amountUSD',
  },
  {
    title: 'Block #',
    dataIndex: 'block',
    key: 'block',
  },
]

const poolColumns = [
  {
    title: 'Pair',
    dataIndex: 'pair',
    key: 'pair',
  },
  {
    title: 'Volume USD',
    dataIndex: 'volume',
    key: 'volume',
  },
  {
    title: 'Fees USD',
    dataIndex: 'fees',
    key: 'fees',
  },
  {
    title: 'Fee Tier',
    dataIndex: 'feeTier',
    key: 'feeTier',
  },
  {
    title: 'TVL',
    dataIndex: 'tvl',
    key: 'tvl',
  },
]

const UniswapData: React.FC = () => {
  const {
    graphs: {
      uniswapV3: { customQuery },
    },
    web3Store: {
      signerState: { address },
    },
  } = useRootStore()

  const swapTableData = customQuery?.data?.swaps?.map((swap) => {
    if (!address) return {}

    const { tokenOut, tokenIn } =
      swap.recipient.toLowerCase() === address.toLowerCase()
        ? { tokenIn: swap.token1.symbol, tokenOut: swap.token0.symbol }
        : { tokenOut: swap.token1.symbol, tokenIn: swap.token0.symbol }

    return {
      key: swap.id,
      tokenIn,
      tokenOut,
      amountUSD: formatNumber(swap.amountUSD, { usd: true }),
      block: swap.transaction.blockNumber,
    }
  })

  const poolTableData = customQuery?.data?.pools?.map((pool) => ({
    key: pool.id,
    pair: `${pool.token0.symbol}/${pool.token1.symbol}`,
    tvl: formatNumber(pool.totalValueLockedUSD, { usd: true }),
    fees: formatNumber(pool.feesUSD, { usd: true }),
    volume: formatNumber(pool.volumeUSD, { usd: true }),
    feeTier: pool.feeTier,
  }))

  return (
    <Wrapper>
      <Title type="h5">Uniswap Subgraph Data</Title>
      <p>100 Highest Volume Pools</p>
      {!customQuery?.data && <p>Loading...</p>}
      {customQuery?.error && <p>Error: {JSON.stringify(customQuery.error)}</p>}
      {customQuery?.data && <Table dataSource={poolTableData} columns={poolColumns} />}

      <p>5 Most Recent Signer Swaps</p>
      {!customQuery?.data && <p>Loading...</p>}
      {customQuery?.error && <p>Error: {JSON.stringify(customQuery.error)}</p>}
      {customQuery?.data && <Table dataSource={swapTableData} columns={swapColumns} />}
    </Wrapper>
  )
}

export default observer(UniswapData)
