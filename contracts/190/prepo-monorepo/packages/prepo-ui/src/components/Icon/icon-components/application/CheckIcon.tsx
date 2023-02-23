import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const CheckIcon: React.FC<Props> = ({ width = '24', height = '24' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 11.8667L8.77273 17L19 6"
      stroke="currentColor"
      stroke-width="1.40788"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
)

export default CheckIcon
