import { ThemeModes } from 'prepo-ui'
import { useRouter } from 'next/router'
import TransactionSummaryLayout from '../Layout'
import * as animationData from '../animation/Success.json'
import { useRootStore } from '../../../context/RootStoreProvider'

type Props = {
  onComplete?: () => void
  url?: string
  buttonText?: string
}

const SuccessContent: React.FC<Props> = ({ onComplete, url, buttonText = 'Explore Markets' }) => {
  const router = useRouter()
  const { uiStore } = useRootStore()
  const { selectedTheme } = uiStore

  const handleComplete = (): void => {
    if (onComplete) {
      onComplete()
    } else {
      router.push('/markets')
    }
  }

  return (
    <TransactionSummaryLayout
      button={{
        children: buttonText,
        onClick: handleComplete,
        type: selectedTheme === ThemeModes.Dark ? 'primary' : 'default',
      }}
      lottieOptions={{
        loop: false,
        animationData,
      }}
      message="Your transaction was successful"
      txUrl={url}
    />
  )
}

export default SuccessContent
