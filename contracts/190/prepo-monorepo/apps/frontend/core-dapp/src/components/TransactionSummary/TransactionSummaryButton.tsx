import { useMemo } from 'react'
import { Button, ButtonProps } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import { UnlockOptions } from '../UnlockTokens'
import { useRootStore } from '../../context/RootStoreProvider'

type Props = {
  buttonText?: string
  disabled?: boolean
  loading?: boolean
  onClick: () => void
  overrideText?: string
  unlock?: UnlockOptions
} & ButtonProps

const TransactionSummaryButton: React.FC<Props> = ({
  overrideText,
  buttonText = 'Continue',
  disabled,
  loading = false,
  onClick,
  unlock,
}) => {
  const { web3Store } = useRootStore()
  const { connected, isNetworkSupported, network } = web3Store
  const emptyAmount = unlock && +unlock.amount === 0
  const amountBN = unlock && unlock.token.parseUnits(unlock.amount)
  const insufficientBalance = unlock && amountBN && amountBN.gt(unlock.token.tokenBalanceRaw || 0)

  const disableButton = useMemo(() => {
    // enable button for switching network if on wrong network
    if (isNetworkSupported)
      return loading || !connected || disabled || insufficientBalance || emptyAmount
    return false
  }, [loading, connected, isNetworkSupported, disabled, insufficientBalance, emptyAmount])

  const getText = (): string => {
    if (!isNetworkSupported) return `Switch to ${network.chainName}`
    if (overrideText) return overrideText
    if (!connected) return 'Connect Your Wallet'
    if (loading) return 'Loading'
    if (insufficientBalance) return 'Insufficient Balance'
    if (emptyAmount) return 'Enter an Amount'
    return buttonText
  }

  return (
    <Button
      block
      type="primary"
      onClick={isNetworkSupported ? onClick : (): void => web3Store.setNetwork(network)}
      loading={loading && connected && isNetworkSupported}
      disabled={disableButton}
    >
      {getText()}
    </Button>
  )
}

export default observer(TransactionSummaryButton)
