import { liquidityTransactionSummaryMock } from './liquidity-transaction-summary.mock'
import TransactionSummary from '../../components/TransactionSummary'
import { Callback } from '../../types/common.types'

const LiquidityTransactionSummary: React.FC = () => {
  const onConfirm = (successCallback: Callback<string>): void => {
    setTimeout(() => {
      successCallback('https://prepo.io')
    }, 1200)
  }

  return (
    <TransactionSummary
      data={liquidityTransactionSummaryMock}
      onConfirm={onConfirm}
      disabled
      buttonText="Coming Soon"
    />
  )
}

export default LiquidityTransactionSummary
