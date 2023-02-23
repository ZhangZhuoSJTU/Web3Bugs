import { useRouter } from 'next/router'
import { observer } from 'mobx-react-lite'
import TransactionSummary from '../../components/TransactionSummary/TransactionSummary'
import { Callback } from '../../types/common.types'
import { useRootStore } from '../../context/RootStoreProvider'
import { EstimatedReceivedAmount, TransactionFee } from '../definitions'

const DepositTransactionSummary: React.FC = () => {
  const router = useRouter()
  const { baseTokenStore, preCTTokenStore, depositStore } = useRootStore()
  const { depositing, depositHash, setDepositHash } = preCTTokenStore
  const { deposit, depositAmount, depositDisabled, depositFees, estimatedReceivedAmount } =
    depositStore

  const onCancel = (): void => {
    setDepositHash(undefined)
  }

  const onComplete = (): void => {
    router.push('/markets')
  }

  const handleDeposit = async (
    successCallback: Callback,
    failedCallback: Callback<string>
  ): Promise<void> => {
    const { error } = await deposit()
    if (error) {
      failedCallback(error)
    } else {
      successCallback()
    }
  }

  const depositTransactionSummary = [
    {
      label: 'Deposit Fees',
      tooltip: <TransactionFee />,
      amount: depositFees,
    },
    {
      label: 'Estimated Received Amount',
      tooltip: <EstimatedReceivedAmount />,
      amount: estimatedReceivedAmount,
    },
  ]

  return (
    <TransactionSummary
      data={depositTransactionSummary}
      disabled={depositDisabled}
      loading={depositing}
      onCancel={onCancel}
      onComplete={onComplete}
      onConfirm={handleDeposit}
      onRetry={handleDeposit}
      transactionHash={depositHash}
      unlock={{
        amount: depositAmount,
        token: baseTokenStore,
        contentType: 'deposit',
        spenderContractName: 'preCT',
      }}
    />
  )
}

export default observer(DepositTransactionSummary)
