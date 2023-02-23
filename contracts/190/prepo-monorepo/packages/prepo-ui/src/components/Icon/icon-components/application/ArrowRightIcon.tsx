import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ArrowRightIcon: React.FC<Props> = ({
  color = 'white',
  width = '28',
  height = '29',
  onClick,
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 28 29"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <path
        d="M10.7979 21.9764L12.4066 23.5851L21.5123 14.4793L12.5266 5.37135L10.9067 6.96897L18.3038 14.4704L10.7979 21.9764Z"
        fill="current"
      />
    </svg>
  )
}

export default ArrowRightIcon
