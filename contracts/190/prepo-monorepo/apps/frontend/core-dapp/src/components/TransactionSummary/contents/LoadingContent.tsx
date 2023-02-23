import TransactionSummaryLayout from '../Layout'
import * as animationData from '../../lottie-animations/LoadingLottie/Loader.json'

type Props = {
  url?: string
}
const LoadingContent: React.FC<Props> = ({ url }) => (
  <TransactionSummaryLayout
    button={{
      children: 'Loading...',
      disabled: true,
    }}
    lottieOptions={{
      animationData,
    }}
    message="Waiting for your transaction"
    txUrl={url}
  />
)

export default LoadingContent
