import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'onClick'>

const PowerIcon: React.FC<Props> = ({ width = '16', height = '16' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M9 0H7V6H9V0Z" fill="currentColor" />
    <path
      d="M12.7 3.80005C12.3 3.40005 11.7 3.50005 11.3 3.90005C10.9 4.30005 11 4.90005 11.4 5.30005C12.4 6.20005 13 7.60005 13 9.00005C13 11.8 10.8 14 8 14C5.2 14 3 11.8 3 9.00005C3 7.60005 3.6 6.20005 4.7 5.30005C5.1 4.90005 5.1 4.30005 4.8 3.90005C4.4 3.50005 3.8 3.50005 3.4 3.80005C1.9 5.10005 1 7.00005 1 9.00005C1 12.9001 4.1 16 8 16C11.9 16 15 12.9001 15 9.00005C15 7.00005 14.2 5.10005 12.7 3.80005Z"
      fill="currentColor"
    />
  </svg>
)

export default PowerIcon
