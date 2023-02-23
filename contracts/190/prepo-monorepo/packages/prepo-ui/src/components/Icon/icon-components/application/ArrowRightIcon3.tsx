import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ArrowRightIcon3: React.FC<Props> = ({
  color = 'white',
  width = '16',
  height = '17',
  onClick,
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 16 17"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <path
        d="M2 8.59454C2 8.96254 2.29867 9.26121 2.66667 9.26121H11.3802L8.80469 11.8367C8.54402 12.0974 8.54402 12.5194 8.80469 12.7794L8.86198 12.8367C9.12265 13.0974 9.54469 13.0974 9.80469 12.8367L13.5755 9.06589C13.8362 8.80523 13.8362 8.38318 13.5755 8.12319L9.80469 4.35235C9.54402 4.09169 9.12198 4.09169 8.86198 4.35235L8.80469 4.40964C8.54402 4.67031 8.54402 5.09235 8.80469 5.35235L11.3802 7.92787L2.66667 7.92787C2.29867 7.92787 2 8.22654 2 8.59454Z"
        fill="current"
      />
    </svg>
  )
}

export default ArrowRightIcon3
