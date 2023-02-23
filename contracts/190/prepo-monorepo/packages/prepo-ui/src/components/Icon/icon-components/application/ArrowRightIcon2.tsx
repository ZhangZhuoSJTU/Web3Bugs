import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ArrowRightIcon2: React.FC<Props> = ({
  color = 'white',
  width = '25',
  height = '25',
  onClick,
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 25 25"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <path
        d="M14.7281 12.6979L10.9179 8.88778C10.5051 8.47495 10.5051 7.80486 10.9179 7.39203C11.3307 6.9792 12.0008 6.9792 12.4137 7.39203L17.0146 11.9929C17.4045 12.3828 17.4045 13.014 17.0146 13.4029L12.4137 18.0039C12.0008 18.4167 11.3307 18.4167 10.9179 18.0039C10.5051 17.591 10.5051 16.9209 10.9179 16.5081L14.7281 12.6979Z"
        fill="current"
      />
    </svg>
  )
}

export default ArrowRightIcon2
