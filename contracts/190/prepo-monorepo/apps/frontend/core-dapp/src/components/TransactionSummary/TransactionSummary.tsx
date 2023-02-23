import { useMemo, useState } from 'react'
import styled from 'styled-components'
import { spacingIncrement } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import DefaultContent from './contents/DefaultContent'
import FailedContent from './contents/FailedContent'
import LoadingContent from './contents/LoadingContent'
import SuccessContent from './contents/SuccessContent'
import TransactionSummaryButton from './TransactionSummaryButton'
import Modal from '../Modal'
import Table, { RowData } from '../Table'
import { Callback } from '../../types/common.types'
import { useRootStore } from '../../context/RootStoreProvider'
import UnlockTokens, { UnlockOptions } from '../UnlockTokens'
import useResponsive from '../../hooks/useResponsive'
import { CURRENCY_PRECISION } from '../../lib/constants'

const defaultErrorMessage = 'Your transaction failed.'
export type TransactionSummaryStatus = 'default' | 'loading' | 'success' | 'failed' | 'unlock'

type HandlerWithCallbacks = (
  successCallback: Callback,
  failedCallback: Callback<string | undefined>
) => void

type Props = {
  buttonText?: string
  data?: RowData[]
  disabled?: boolean
  loading?: boolean
  onCancel?: () => void
  onComplete?: () => void
  onConfirm?: HandlerWithCallbacks
  onRetry?: HandlerWithCallbacks
  overrideText?: string
  successButtonText?: string
  title?: React.ReactNode
  transactionHash?: string
  unlock?: UnlockOptions
  withoutModalButton?: boolean
}

const TableWrapper = styled.div`
  margin-bottom: ${spacingIncrement(22)};
`

const TransactionSummary: React.FC<Props> = ({
  buttonText,
  children,
  data,
  disabled,
  loading = false,
  onCancel,
  onComplete,
  onConfirm,
  onRetry,
  overrideText,
  successButtonText,
  title,
  transactionHash,
  unlock,
  withoutModalButton = false,
}) => {
  const { web3Store } = useRootStore()
  const { isNetworkSupported, network } = web3Store
  const { isPhone } = useResponsive()
  const [showSummary, setShowSummary] = useState(withoutModalButton)
  const [errorMessage, setErrorMessage] = useState(defaultErrorMessage)
  const [status, setStatus] = useState<TransactionSummaryStatus>('default')

  const checkRequiresUnlockToken = (): boolean | undefined => {
    if (!unlock) return false
    const { amount, token, spenderContractName } = unlock
    return token.needToAllowFor(amount, spenderContractName)
  }
  const requiresUnlockToken = checkRequiresUnlockToken()
  const unlocking = unlock?.token.approving
  const buttonLoading =
    isNetworkSupported && (loading || requiresUnlockToken === undefined || unlocking)
  const disabledClose = status === 'loading' || loading || unlocking

  const callbackFailed = (message?: string): void => {
    setErrorMessage(message || defaultErrorMessage)
    setStatus('failed')
  }

  const callbackSuccess = (): void => {
    setStatus('success')
  }

  const handleCancel = (): void => {
    if (disabledClose) return
    setStatus('default')
    if (status === 'unlock') return
    if (onCancel) onCancel()
    setShowSummary(false)
  }

  const sendCallbacks = (action?: HandlerWithCallbacks): void => {
    if (!action) return
    setStatus('loading')
    action(callbackSuccess, callbackFailed)
  }

  const handleConfirm = (): void => {
    if (requiresUnlockToken === undefined) return
    if (requiresUnlockToken) {
      setStatus('unlock')
    } else {
      sendCallbacks(onConfirm)
    }
  }

  const handleRetry = (): void => sendCallbacks(onRetry)

  const showModal = (): void => setShowSummary(true)

  const renderTitle = useMemo(() => {
    if (status === 'unlock') return ''
    return title || 'Transaction Summary'
  }, [status, title])

  const renderModalContent = (): React.ReactNode => {
    const url = transactionHash ? web3Store.getBlockExplorerUrl(transactionHash) : undefined
    switch (status) {
      case 'unlock': {
        // eslint-disable-next-line react/jsx-props-no-spreading
        if (isNetworkSupported && requiresUnlockToken && unlock) return <UnlockTokens {...unlock} />
        setStatus('default')
        return null
      }
      case 'loading':
        return <LoadingContent url={url} />
      case 'success':
        return <SuccessContent onComplete={onComplete} url={url} buttonText={successButtonText} />
      case 'failed':
        return <FailedContent errorMessage={errorMessage} handleRetry={handleRetry} url={url} />
      default: {
        const defaultContentButtontext = isNetworkSupported
          ? buttonText ?? (requiresUnlockToken ? 'Approve' : 'Confirm')
          : `Switch to ${network.displayName ?? network.chainName}`
        return (
          <DefaultContent
            button={{
              children: defaultContentButtontext,
              disabled:
                ((unlock && +unlock.amount === 0) || disabled || buttonLoading) &&
                isNetworkSupported,
              loading: buttonLoading,
              onClick: isNetworkSupported
                ? handleConfirm
                : (): void => web3Store.setNetwork(network),
              type: 'primary',
            }}
          >
            {data && (
              <TableWrapper>
                <Table data={data} percentagePrecision={CURRENCY_PRECISION} />
              </TableWrapper>
            )}
            {children}
          </DefaultContent>
        )
      }
    }
  }

  return (
    <div>
      {!withoutModalButton && (
        <TransactionSummaryButton
          buttonText={buttonText}
          disabled={disabled || buttonLoading}
          loading={buttonLoading}
          onClick={showModal}
          overrideText={overrideText}
          unlock={unlock}
        />
      )}
      <Modal
        bottom={isPhone}
        centered
        disabledClose={disabledClose}
        footer={null}
        onCancel={handleCancel}
        title={renderTitle}
        titleAlign="left"
        visible={showSummary}
      >
        {renderModalContent()}
      </Modal>
    </div>
  )
}

export default observer(TransactionSummary)
