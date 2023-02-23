import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const MinusIcon: React.FC<Props> = ({ color = 'white', width = '15', height = '15', onClick }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 15 15"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <path
        d="M2.57471 6.73715H2.11801V7.19385V8.3356V8.7923H2.57471H12.8505H13.3072V8.3356V7.19385V6.73715H12.8505H2.57471Z"
        fill="current"
        stroke="current"
        strokeWidth="0.9134"
      />
    </svg>
  )
}

export default MinusIcon
