import Lottie from 'react-lottie'
import * as animationData from './Loader.json'

const defaultLottieOptions = {
  loop: true,
  autoplay: true,
  rendererSettings: {
    preserveAspectRatio: 'xMidYMid slice',
  },
}

type Props = {
  height: number
  width: number
}

const LoadingLottie: React.FC<Props> = ({ height, width }) => (
  <Lottie
    height={height}
    width={width}
    options={{ ...defaultLottieOptions, ...{ animationData } }}
  />
)

export default LoadingLottie
