import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const Ethereum: React.FC<Props> = ({ width = '40', height = '40' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="38.8939" height="38.8939" transform="translate(0.523438 0.520264)" fill="white" />
    <path
      d="M19.3613 5.38208V16.1654L28.4751 20.2385L19.3613 5.38208Z"
      fill="#627EEA"
      fillOpacity="0.602"
    />
    <path d="M19.3618 5.38232L10.248 20.2387L19.3618 16.1657V5.38232Z" fill="#627EEA" />
    <path
      d="M19.3613 27.2252V34.5524L28.4804 21.9346L19.3613 27.2252Z"
      fill="#627EEA"
      fillOpacity="0.602"
    />
    <path d="M19.3618 34.5524V27.2252L10.248 21.9346L19.3618 34.5524Z" fill="#627EEA" />
    <path
      d="M19.3613 25.5291L28.4751 20.2384L19.3613 16.1654V25.5291Z"
      fill="#627EEA"
      fillOpacity="0.2"
    />
    <path
      d="M10.248 20.2384L19.3618 25.5291V16.1654L10.248 20.2384Z"
      fill="#627EEA"
      fillOpacity="0.602"
    />
  </svg>
)

export default Ethereum
