import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ChevronUpIcon: React.FC<Props> = ({ width = '16', height = '16', onClick }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    onClick={onClick}
  >
    <path
      d="M7.99997 7.23106L12.0826 11.0338C12.5249 11.4458 13.2429 11.4458 13.6853 11.0338C14.1276 10.6218 14.1276 9.95298 13.6853 9.54096L8.75537 4.94903C8.3376 4.5599 7.66127 4.5599 7.24457 4.94903L2.31467 9.54096C1.87232 9.95298 1.87232 10.6218 2.31467 11.0338C2.75701 11.4458 3.47502 11.4458 3.91737 11.0338L7.99997 7.23106Z"
      fill="currentColor"
    />
  </svg>
)

export default ChevronUpIcon
