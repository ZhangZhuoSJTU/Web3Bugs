import { TransactionReceipt } from './utils/stores.types'

export type SendTransactionReturn = {
  hash: string
  wait: () => Promise<TransactionReceipt>
}
