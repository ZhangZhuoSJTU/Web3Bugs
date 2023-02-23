import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import {
  ACTIONS_RECEIVE,
  ACTIONS_SEND,
  EVENTS_SWAP,
  EVENTS_TRANSFER,
  HistoricalEventTypes,
  ONE_BI,
  ZERO_ADDRESS,
} from './constants'
import { CollateralToken, HistoricalEvent, Pool, Transaction } from '../generated/types/schema'

function getTransactionsForHistoricalEvent(
  historicalEvent: HistoricalEvent
): (Transaction | null)[] {
  return historicalEvent.transactions.map<Transaction | null>((id) => Transaction.load(id))
}

/**
 * Deposit flow conditions:
 * 1. Owner received collateral tokens
 * 2. Owner sent base token
 * 3. CollateralTokenContract received base token
 * 4. Collateral tokens sent to owner are minted from zero address
 */
export function isDeposit(historicalEvent: HistoricalEvent): boolean {
  const transactions = getTransactionsForHistoricalEvent(historicalEvent)
  let hasReceiveCollateralToken = false
  let hasSendBaseToken = false
  let userInputAmount: BigDecimal = historicalEvent.amount
  let userInputAmountUSD: BigDecimal = historicalEvent.amountUSD
  let receivedCollateral: string | null = null
  if (historicalEvent.txCount.le(ONE_BI)) return false
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i]
    if (transaction !== null && transaction.event == EVENTS_TRANSFER) {
      // this transaction is about receiving collateral token
      if (
        !hasReceiveCollateralToken &&
        transaction.action == ACTIONS_RECEIVE &&
        transaction.collateralToken !== null
      ) {
        const mintedFromZeroAddress = transaction.senderAddress == ZERO_ADDRESS
        const recipientIsOwner = transaction.recipientAddress == transaction.ownerAddress
        hasReceiveCollateralToken = mintedFromZeroAddress && recipientIsOwner
        receivedCollateral = transaction.collateralToken
      }

      // this transaction is about sending base token
      if (
        !hasSendBaseToken &&
        transaction.action == ACTIONS_SEND &&
        transaction.baseToken !== null
      ) {
        const senderIsOwner = transaction.senderAddress == transaction.ownerAddress
        const recipientIsCollateralToken =
          CollateralToken.load(transaction.recipientAddress) !== null
        hasSendBaseToken = senderIsOwner && recipientIsCollateralToken
        if (hasSendBaseToken) {
          userInputAmount = transaction.amount
          userInputAmountUSD = transaction.amountUSD
          receivedCollateral = transaction.recipientAddress
        }
      }
    }
  }

  const valid = hasReceiveCollateralToken && hasSendBaseToken && receivedCollateral !== null
  if (valid) {
    historicalEvent.event = new HistoricalEventTypes().deposit
    historicalEvent.amount = userInputAmount
    historicalEvent.amountUSD = userInputAmountUSD
    historicalEvent.collateralToken = receivedCollateral
    historicalEvent.save()
  }
  return valid
}

/**
 * Withdraw flow conditions:
 * 1. Owner sent collateral tokens (burnt only - to zero address)
 * 2. Owner received base token (sent from collateral token contract)
 * 3. CollateralTokenContract sent baseToken to owner
 * 4. BurnAddress received collateralToken
 */
export function isWithdraw(historicalEvent: HistoricalEvent): boolean {
  const transactions = getTransactionsForHistoricalEvent(historicalEvent)

  let hasReceiveBaseToken = false
  let hasSendCollateralToken = false
  let userInputAmount: BigDecimal = historicalEvent.amount
  let userInputAmountUSD: BigDecimal = historicalEvent.amountUSD
  let sentCollateral: string | null = null
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i]
    if (transaction !== null && transaction.event == EVENTS_TRANSFER) {
      // this transaction is about receiving baseToken
      if (
        !hasReceiveBaseToken &&
        transaction.action == ACTIONS_RECEIVE &&
        transaction.baseToken !== null
      ) {
        const sentFromCollateral = CollateralToken.load(transaction.senderAddress) !== null
        const recipientIsOwner = transaction.recipientAddress == transaction.ownerAddress
        hasReceiveBaseToken = sentFromCollateral && recipientIsOwner
        if (hasReceiveBaseToken) {
          sentCollateral = transaction.senderAddress
        }
      }

      if (
        !hasSendCollateralToken &&
        transaction.action == ACTIONS_SEND &&
        transaction.collateralToken !== null
      ) {
        const collateralTokenBurnt = transaction.recipientAddress == ZERO_ADDRESS
        const senderIsOwner = transaction.senderAddress == transaction.ownerAddress
        hasSendCollateralToken = collateralTokenBurnt && senderIsOwner

        if (hasSendCollateralToken) {
          userInputAmount = transaction.amount
          userInputAmountUSD = transaction.amountUSD
          sentCollateral = transaction.collateralToken
        }
      }
    }
  }

  const valid = hasReceiveBaseToken && hasSendCollateralToken && sentCollateral !== null
  if (valid) {
    historicalEvent.event = new HistoricalEventTypes().withdraw
    historicalEvent.amount = userInputAmount
    historicalEvent.amountUSD = userInputAmountUSD
    historicalEvent.collateralToken = sentCollateral
    historicalEvent.save()
  }
  return valid
}

/**
 * Open flow conditions:
 * 1. LongShortToken has Transfer event
 * 2. recipient of LongShort’s transfer is owner
 * 3. sender of LongShort’s transfer is valid pool address
 * 4. CollateralToken has Transfer event
 * 5. recipient of CollateralToken’s Transfer is valid pool address
 * 6. sender of CollateralToken’s Transfer is owner
 * 7. Swap event’s recipient is owner
 */
export function isOpenClose(historicalEvent: HistoricalEvent): boolean {
  const transactions = getTransactionsForHistoricalEvent(historicalEvent)

  if (!historicalEvent.txCount.equals(BigInt.fromI32(3))) return false

  // open flow variables
  let hasReceiveLongShortToken = false
  let hasSendCollateralToken = false
  // close flow variables
  let hasSendLongShortToken = false
  let hasReceiveCollateralToken = false

  let hasSwapped = false
  let userInputAmount = historicalEvent.amount
  let userInputAmountUSD = historicalEvent.amountUSD
  let tradedLongShortToken: string | null = null

  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i]
    if (transaction !== null) {
      if (transaction.event == EVENTS_TRANSFER) {
        if (transaction.longShortToken !== null) {
          // receiving longShortToken = potential open flow
          if (!hasReceiveLongShortToken && transaction.action == ACTIONS_RECEIVE) {
            const ownerIsRecipient = transaction.recipientAddress == transaction.ownerAddress
            const validSender = Pool.load(transaction.senderAddress) !== null
            hasReceiveLongShortToken = ownerIsRecipient && validSender
            if (hasReceiveLongShortToken) {
              tradedLongShortToken = transaction.longShortToken
              userInputAmount = transaction.amount
            }
          }
          // sending longShortToken = potential close flow
          if (!hasSendLongShortToken && transaction.action == ACTIONS_SEND) {
            const ownerIsSender = transaction.ownerAddress == transaction.senderAddress
            const validRecipient = Pool.load(transaction.recipientAddress) !== null
            hasSendLongShortToken = ownerIsSender && validRecipient
            if (hasSendLongShortToken) {
              tradedLongShortToken = transaction.longShortToken
              userInputAmount = transaction.amount
              userInputAmountUSD = transaction.amountUSD
            }
          }
        }

        if (transaction.collateralToken !== null) {
          // sending collateral token = potential open flow
          if (!hasSendCollateralToken && transaction.action == ACTIONS_SEND) {
            const ownerIsSender = transaction.senderAddress == transaction.ownerAddress
            const validRecipient = Pool.load(transaction.recipientAddress) !== null
            hasSendCollateralToken = ownerIsSender && validRecipient
          }

          // receiving collateral token = potential close flow
          if (!hasReceiveCollateralToken && transaction.action == ACTIONS_RECEIVE) {
            const ownerIsRecipient = transaction.recipientAddress == transaction.ownerAddress
            const validSender = Pool.load(transaction.senderAddress) !== null
            hasReceiveCollateralToken = ownerIsRecipient && validSender
          }
        }
      }

      if (transaction.event == EVENTS_SWAP && transaction.pool !== null) {
        const ownerIsRecipient = transaction.recipientAddress == transaction.ownerAddress
        // if we observe more patterns/conditions we should add them here
        hasSwapped = ownerIsRecipient
        if (hasSwapped && !hasSendLongShortToken) {
          userInputAmountUSD = transaction.amountUSD
        }
      }
    }
  }

  const commonConditionsValid = hasSwapped && tradedLongShortToken !== null
  const validClose = hasReceiveCollateralToken && hasSendLongShortToken && commonConditionsValid
  const validOpen = hasReceiveLongShortToken && hasSendCollateralToken && commonConditionsValid
  if (validClose || validOpen) {
    historicalEvent.amount = userInputAmount
    historicalEvent.amountUSD = userInputAmountUSD
    historicalEvent.longShortToken = tradedLongShortToken
    historicalEvent.event = validOpen
      ? new HistoricalEventTypes().open
      : new HistoricalEventTypes().close
    historicalEvent.save()
    return true
  }

  return false
}
