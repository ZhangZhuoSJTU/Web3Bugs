import { ThemeModes } from 'prepo-ui'
import TransactionSummaryLayout from '../Layout'
import * as animationData from '../animation/Error.json'
import { useRootStore } from '../../../context/RootStoreProvider'

type Props = {
  errorMessage?: string
  handleRetry?: () => void
  url?: string
}

const FailedContent: React.FC<Props> = ({ errorMessage, handleRetry, url }) => {
  const { uiStore } = useRootStore()
  const { selectedTheme } = uiStore
  return (
    <TransactionSummaryLayout
      button={{
        children: 'Retry Transaction',
        onClick: handleRetry,
        type: selectedTheme === ThemeModes.Dark ? 'primary' : 'default',
      }}
      lottieOptions={{
        loop: false,
        animationData,
      }}
      message={errorMessage}
      txUrl={url}
    />
  )
}

export default FailedContent
