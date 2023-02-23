import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ArrowLeftIcon: React.FC<Props> = ({
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
        d="M10.6863 12.5497L14.5073 8.72871C14.9213 8.31471 14.9213 7.64271 14.5073 7.22871C14.0933 6.81471 13.4213 6.81471 13.0073 7.22871L8.39335 11.8427C8.00235 12.2337 8.00235 12.8667 8.39335 13.2567L13.0073 17.8707C13.4213 18.2847 14.0933 18.2847 14.5073 17.8707C14.9213 17.4567 14.9213 16.7847 14.5073 16.3707L10.6863 12.5497Z"
        fill="current"
      />
    </svg>
  )
}

export default ArrowLeftIcon
