import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const SortDownIcon: React.FC<Props> = ({
  color = 'white',
  width = '10',
  height = '6',
  onClick,
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 10 6"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <path
        d="M0.804672 1.138L4.52867 4.862C4.78934 5.12267 5.21134 5.12267 5.47134 4.862L9.19534 1.138C9.61534 0.718 9.31801 0 8.72401 0H1.27601C0.682006 0 0.384672 0.718 0.804672 1.138Z"
        fill={color}
      />
    </svg>
  )
}

export default SortDownIcon
