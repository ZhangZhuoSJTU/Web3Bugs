import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import {
  BaseToken,
  CollateralToken,
  HistoricalEvent,
  LongShortToken,
  Pool,
  Transaction,
} from '../generated/types/schema'
import { Transfer as ERC20Transfer } from '../generated/types/templates/BaseToken/ERC20'
import {
  ACTIONS_CLOSE,
  ACTIONS_OPEN,
  ACTIONS_RECEIVE,
  ACTIONS_SEND,
  EVENTS_SWAP,
  EVENTS_TRANSFER,
  ZERO_BD,
  ZERO_BI,
} from '../utils/constants'
import { Swap } from '../generated/types/templates/UniswapV3Pool/UniswapV3Pool'
import { isDeposit, isOpenClose, isWithdraw } from '../utils/transactions'

export function makeTransactionId(
  event: string,
  ownerAddress: string,
  transactionHash: string,
  logIndex: BigInt
): string {
  return `${event}-${ownerAddress}-${transactionHash}-${logIndex.toString()}`
}

export function makeHistoricalEventId(hashString: string, ownerAddressString: string): string {
  return `${hashString}-${ownerAddressString}`
}

export function makeTransaction(
  event: ethereum.Event,
  ownerAddress: Address,
  action: string
): Transaction {
  const contractAddress = event.address.toHexString()
  const hashString = event.transaction.hash.toHexString()
  const ownerAddressString = ownerAddress.toHexString()
  const id = makeTransactionId(action, ownerAddressString, hashString, event.transactionLogIndex)
  const transaction = new Transaction(id)
  const historicalEventId = makeHistoricalEventId(hashString, ownerAddressString)

  transaction.action = action
  transaction.createdAtBlockNumber = event.block.number
  transaction.createdAtTimestamp = event.block.timestamp
  transaction.hash = hashString
  transaction.ownerAddress = ownerAddressString
  transaction.contractAddress = contractAddress
  transaction.historicalEvent = historicalEventId

  return transaction
}

export function makeTransferTransaction(
  event: ERC20Transfer,
  ownerAddress: Address,
  action: string
): Transaction {
  const transaction = makeTransaction(event, ownerAddress, action)
  const amountBD = event.params.value.toBigDecimal()
  transaction.amount = amountBD
  transaction.amountUSD = amountBD
  transaction.event = EVENTS_TRANSFER
  transaction.recipientAddress = event.params.to.toHexString()
  transaction.senderAddress = event.params.from.toHexString()

  return transaction
}

export function getHistoricalEvent(transaction: Transaction): HistoricalEvent {
  const id = makeHistoricalEventId(transaction.hash, transaction.ownerAddress)
  let historicalEvent = HistoricalEvent.load(id)
  if (historicalEvent === null) {
    historicalEvent = new HistoricalEvent(id)
    historicalEvent.amount = transaction.amount
    historicalEvent.amountUSD = transaction.amountUSD
    historicalEvent.createdAtBlockNumber = transaction.createdAtBlockNumber
    historicalEvent.createdAtTimestamp = transaction.createdAtTimestamp
    historicalEvent.event = transaction.action
    historicalEvent.hash = transaction.hash
    historicalEvent.ownerAddress = transaction.ownerAddress
    historicalEvent.transactions = new Array<string>()
    historicalEvent.txCount = ZERO_BI
  }
  const transactions = historicalEvent.transactions
  transactions.push(transaction.id)
  historicalEvent.transactions = transactions
  historicalEvent.txCount = BigInt.fromI32(transactions.length)

  // always check those that requires more txCount first
  if (isOpenClose(historicalEvent)) return historicalEvent
  if (isDeposit(historicalEvent)) return historicalEvent
  if (isWithdraw(historicalEvent)) return historicalEvent
  historicalEvent.save()
  return historicalEvent
}

export function addBaseTokenTransactions(event: ERC20Transfer): void {
  const baseToken = BaseToken.load(event.address.toHexString())
  if (baseToken === null) return // impossible
  let collateralToken = CollateralToken.load(event.params.to.toHexString())

  // transfer of base token irrelevant to prePO
  if (collateralToken === null) {
    collateralToken = CollateralToken.load(event.params.from.toHexString())
    if (collateralToken === null) return
  }

  const fromTransaction = makeTransferTransaction(event, event.params.from, ACTIONS_SEND)
  const toTransaction = makeTransferTransaction(event, event.params.to, ACTIONS_RECEIVE)

  fromTransaction.baseToken = baseToken.id
  fromTransaction.save()

  toTransaction.baseToken = baseToken.id
  toTransaction.save()

  getHistoricalEvent(fromTransaction)
  getHistoricalEvent(toTransaction)
}

export function addCollateralTransactions(event: ERC20Transfer): void {
  const collateralToken = CollateralToken.load(event.address.toHexString())
  if (collateralToken === null) return

  const fromTransaction = makeTransferTransaction(event, event.params.from, ACTIONS_SEND)
  const toTransaction = makeTransferTransaction(event, event.params.to, ACTIONS_RECEIVE)

  fromTransaction.collateralToken = collateralToken.id
  fromTransaction.save()

  toTransaction.collateralToken = collateralToken.id
  toTransaction.save()

  getHistoricalEvent(fromTransaction)
  getHistoricalEvent(toTransaction)
}

export function addLongShortTokenTransactions(event: ERC20Transfer): void {
  const longShortToken = LongShortToken.load(event.address.toHexString())
  if (longShortToken === null) return

  const fromTransaction = makeTransferTransaction(event, event.params.from, ACTIONS_SEND)
  const toTransaction = makeTransferTransaction(event, event.params.to, ACTIONS_RECEIVE)

  const valueBD = event.params.value.toBigDecimal()
  const valueUSD = longShortToken.priceUSD.times(valueBD)

  fromTransaction.amountUSD = valueUSD
  fromTransaction.longShortToken = longShortToken.id
  fromTransaction.save()

  toTransaction.amountUSD = valueUSD
  toTransaction.longShortToken = longShortToken.id
  toTransaction.save()

  getHistoricalEvent(fromTransaction)
  getHistoricalEvent(toTransaction)
}

export function addSwapTransactions(event: Swap, pool: Pool): void {
  const token = LongShortToken.load(pool.longShortToken)
  if (token === null) return // impossible

  const amount0BD = event.params.amount0.toBigDecimal()
  const amount1BD = event.params.amount1.toBigDecimal()

  const longShortTokenIsToken0 = pool.longShortToken === pool.token0

  const collateralAmountBD = longShortTokenIsToken0 ? amount1BD : amount0BD
  const longShortTokenAmountBD = longShortTokenIsToken0 ? amount0BD : amount1BD

  const closing = collateralAmountBD.lt(ZERO_BD)

  const transaction = makeTransaction(
    event,
    event.transaction.from,
    closing ? ACTIONS_CLOSE : ACTIONS_OPEN
  )

  const amountBD = closing ? collateralAmountBD : longShortTokenAmountBD
  const amountUSD = closing ? token.priceUSD.times(longShortTokenAmountBD) : collateralAmountBD

  transaction.amount = amountBD
  transaction.amountUSD = amountUSD
  transaction.event = EVENTS_SWAP
  transaction.pool = pool.id
  transaction.recipientAddress = event.params.recipient.toHexString()
  transaction.senderAddress = event.params.sender.toHexString()

  transaction.save()

  getHistoricalEvent(transaction)
}
