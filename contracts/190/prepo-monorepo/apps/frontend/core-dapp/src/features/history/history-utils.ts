import { IconName } from 'prepo-ui'
import { formatEther } from 'ethers/lib/utils'
import { SupportedNetworks } from 'prepo-constants'
import {
  HistoricalEvent,
  HistoricalEventCollateralToken,
  HistoricalEventLongShortToken,
  HistoryTransaction,
} from './history.types'
import { PositionType } from '../../utils/prepo.types'
import { markets } from '../../lib/markets'
import { supportedMarketTokens } from '../../lib/markets-tokens-contracts'
import { supportedMarkets } from '../../lib/markets-contracts'
import { FilterType } from '../../components/Filter/filter.constants'

type DynamicHistoryTransactionProps = {
  iconName: IconName
  name: string
  eventType?: PositionType
  marketId?: string
}

export const iconSymbolMap: { [key: string]: IconName } = {
  FAKEUSD: 'usdc',
}

export const KNOWN_HISTORY_EVENTS: { [key: string]: FilterType } = {
  WITHDRAW: FilterType.Withdrawn,
  DEPOSIT: FilterType.Deposited,
  OPEN: FilterType.Opened,
  CLOSE: FilterType.Closed,
}

export const KNOWN_HISTORY_EVENTS_MAP: { [key: string]: string } = Object.entries(
  KNOWN_HISTORY_EVENTS
).reduce((obj, [key, value]) => {
  // eslint-disable-next-line no-param-reassign
  obj[value] = key
  return obj
}, {} as { [key: string]: string })

export const KNOWN_TRANSACTION_ACTIONS: { [key: string]: string } = {
  RECEIVE: 'Received',
  SEND: 'Sent',
}

const findCollateralTokenStaticData = (
  collateralToken?: HistoricalEventCollateralToken
): DynamicHistoryTransactionProps | undefined => {
  if (!collateralToken) return undefined
  const { symbol } = collateralToken.baseToken.token
  const iconName = iconSymbolMap[symbol]
  if (iconName) return { iconName, name: symbol.toUpperCase() }
  return undefined
}

const findLongShortTokenStaticData = (
  network: SupportedNetworks,
  longShortToken?: HistoricalEventLongShortToken
): Required<DynamicHistoryTransactionProps> | undefined => {
  if (!longShortToken) return undefined
  const market = markets.find(
    ({ address }) =>
      supportedMarkets[address]?.[network]?.toLowerCase() === longShortToken.market.id.toLowerCase()
  )
  if (!market) return undefined
  const localShortToken = supportedMarketTokens[market.short.tokenAddress][network]
  const isShort = localShortToken?.toLowerCase() === longShortToken.id.toLowerCase()

  return {
    eventType: isShort ? 'short' : 'long',
    iconName: market.iconName,
    name: market.name,
    marketId: market.urlId,
  }
}
/**
 * Goal: Only show events we recognize in historical transactions
 * e.g. Deposit/Withdraw funds, Open/Long trades, Send/Receive or known relevant tokens (base token isn't relevant)
 *
 * If user writes a contract that aggregates multiple events within a single transaction
 * We don't need to display those events since we won't know what event that is
 * Strategy:
 * 1) Check if the HistoricalEvent has event we recognize (these are features available in our UI, features we offer)
 * 2) If not, check if the underlying transactions are relevant to prePO
 *      - If the transaction is of action SEND or RECEIVE
 *      - If the transaction is either Collateral or LongShort token
 * 3) Ignore all irrelevant transactions
 */
export const formatHistoricalEvent = (
  events: HistoricalEvent[] | undefined,
  network: SupportedNetworks
): HistoryTransaction[] | undefined => {
  if (events === undefined) return undefined
  const formattedEvents: HistoryTransaction[] = []
  events.forEach(
    ({
      amountUSD,
      collateralToken,
      createdAtTimestamp,
      event,
      hash,
      longShortToken,
      transactions,
    }) => {
      // get rid of decimals
      const trimmedAmount = amountUSD.toString().split('.')[0]
      const value = +formatEther(trimmedAmount)
      const validEvent = KNOWN_HISTORY_EVENTS[event]

      // already guessed the event from Subgraph, just have to find the right icon and name to use here
      if (validEvent) {
        // deposit/withdraw of collateral token
        const collateralTokenData = findCollateralTokenStaticData(collateralToken)
        // open/close of long short position
        const longShortTokenData = findLongShortTokenStaticData(network, longShortToken)

        const iconName = collateralTokenData?.iconName ?? longShortTokenData?.iconName
        const name = collateralTokenData?.name ?? longShortTokenData?.name
        if (iconName !== undefined && name !== undefined)
          formattedEvents.push({
            event: validEvent,
            timestamp: createdAtTimestamp,
            transactionHash: hash,
            usdValue: value,
            iconName,
            name,
            eventType: longShortTokenData?.eventType,
            marketId: longShortTokenData?.marketId,
          })
      } else {
        // find Send/Receive of Collateral/LongShort tokens
        transactions.forEach((tx) => {
          const validAction = KNOWN_TRANSACTION_ACTIONS[tx.action]
          if (validAction) {
            const collateralTokenData = findCollateralTokenStaticData(tx.collateralToken)
            const longShortTokenData = findLongShortTokenStaticData(network, tx.longShortToken)

            const iconName = collateralTokenData?.iconName ?? longShortTokenData?.iconName
            const name = collateralTokenData?.name ?? longShortTokenData?.name

            if (iconName !== undefined && name !== undefined)
              formattedEvents.push({
                event: validAction,
                timestamp: tx.createdAtTimestamp,
                transactionHash: hash,
                usdValue: +formatEther(tx.amountUSD.toString().split('.')[0]),
                iconName,
                name,
                marketId: longShortTokenData?.marketId,
              })
          }
        })
      }
    }
  )
  return formattedEvents
}
