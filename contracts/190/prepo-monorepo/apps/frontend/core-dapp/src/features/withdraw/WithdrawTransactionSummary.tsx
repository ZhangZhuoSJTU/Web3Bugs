import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import TransactionSummary from '../../components/TransactionSummary/TransactionSummary'
import { Callback } from '../../types/common.types'
import { useRootStore } from '../../context/RootStoreProvider'
import { balanceToNumber } from '../../utils/number-utils'
import { RowData } from '../../components/Table'
import { EstimatedWithdrawAmount, TransactionFee } from '../definitions'

const WithdrawTransactionSummary: React.FC = () => {
  const router = useRouter()
  const { preCTTokenStore, withdrawStore } = useRootStore()
  const {
    donationPercentage,
    donationAmount,
    withdrawalDisabled,
    withdrawalFees,
    withdrawalReceivedAmount,
    withdrawUILoading,
  } = withdrawStore
  const { withdrawHash } = preCTTokenStore

  const onCancel = (): void => {
    preCTTokenStore.setWithdrawHash(undefined)
  }

  const onComplete = (): void => {
    router.push('/markets')
  }

  const handleWithdraw = async (
    successCallback: Callback,
    failedCallback: Callback<string>
  ): Promise<void> => {
    const { error } = await withdrawStore.withdraw()
    if (error) {
      failedCallback(error)
    } else {
      successCallback()
    }
  }

  const withdrawTransactionSummary = useMemo(() => {
    const data: RowData[] = [
      {
        label: 'Withdrawal Fees',
        tooltip: <TransactionFee />,
        amount: balanceToNumber(withdrawalFees),
      },
    ]
    if (donationPercentage > 0) {
      data.push({
        label: 'Charity Donation',
        tooltip: 'Some tooltip',
        amount: donationAmount,
        percent: donationPercentage / 100,
      })
    }
    data.push({
      label: 'Estimated Received Amount',
      tooltip: <EstimatedWithdrawAmount />,
      amount: withdrawalReceivedAmount || '0',
    })
    return data
  }, [donationAmount, donationPercentage, withdrawalFees, withdrawalReceivedAmount])

  return (
    <TransactionSummary
      data={withdrawTransactionSummary}
      disabled={withdrawalDisabled}
      loading={withdrawUILoading}
      onCancel={onCancel}
      onComplete={onComplete}
      onConfirm={handleWithdraw}
      onRetry={handleWithdraw}
      transactionHash={withdrawHash}
    />
  )
}

export default observer(WithdrawTransactionSummary)
