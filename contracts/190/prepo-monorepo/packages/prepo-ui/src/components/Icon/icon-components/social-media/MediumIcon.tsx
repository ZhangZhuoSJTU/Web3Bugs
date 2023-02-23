import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const MediumIcon: React.FC<Props> = ({ width = '24', height = '24' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1.04348 2.4L3.13043 5.04126V17.591L0 21.5929H7.30435L4.17391 17.591V6.42014L10.9565 21.5929L10.9555 21.6L17.2174 6.31376V19.518L15.1304 21.5929H24L21.913 19.518L21.8988 4.7363L23.9287 2.40709H17.6586L12.8376 14.198L7.56318 2.4H1.04348Z"
      fill="currentColor"
    />
  </svg>
)

export default MediumIcon
