import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ChevronDownIcon: React.FC<Props> = ({ width = '16', height = '16', onClick }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    onClick={onClick}
  >
    <path
      d="M8 8.76676L12.071 4.97482C12.5121 4.56396 13.2281 4.56396 13.6692 4.97482C14.1103 5.38567 14.1103 6.05256 13.6692 6.46341L8.75326 11.0423C8.33668 11.4304 7.66226 11.4304 7.24674 11.0423L2.33082 6.46341C1.88973 6.05256 1.88973 5.38567 2.33082 4.97482C2.77191 4.56396 3.48788 4.56396 3.92897 4.97482L8 8.76676Z"
      fill="currentColor"
    />
  </svg>
)

export default ChevronDownIcon
