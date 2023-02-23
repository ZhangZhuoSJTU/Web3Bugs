import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'onClick'>

const EnergyIcon: React.FC<Props> = ({ color = 'white', width = '25', height = '25' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 17 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M16.7435 12.7641C16.7435 12.0224 16.249 11.528 15.5074 11.528H9.32672V1.0209C9.32672 0.650057 9.07949 0.402832 8.70865 0.402832C8.46143 0.402832 8.2142 0.526445 8.2142 0.77367L0.797441 14.7419C0.673828 14.8655 0.673828 14.9891 0.673828 15.2364C0.673828 15.978 1.16828 16.4725 1.90996 16.4725H8.09059V26.9796C8.09059 27.3504 8.33782 27.5976 8.70865 27.5976C8.95588 27.5976 9.2031 27.474 9.2031 27.2268L16.4963 13.3822C16.6199 13.1349 16.7435 13.0113 16.7435 12.7641Z"
      fill={color}
    />
  </svg>
)

export default EnergyIcon
