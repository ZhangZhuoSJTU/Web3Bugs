import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const CrossIcon: React.FC<Props> = ({  width = '25', height = '25', onClick }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 25 25"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <path
        d="M5.64269 3.52772L5.5127 3.39772L5.3827 3.52772L3.96864 4.94178L3.83864 5.07178L3.96864 5.20177L11.1316 12.3647L3.96864 19.5277L3.83864 19.6577L3.96864 19.7877L5.3827 21.2018L5.5127 21.3318L5.64269 21.2018L12.8057 14.0388L19.9686 21.2018L20.0986 21.3318L20.2286 21.2018L21.6427 19.7877L21.7727 19.6577L21.6427 19.5277L14.4797 12.3647L21.6427 5.20177L21.7727 5.07178L21.6427 4.94178L20.2286 3.52772L20.0986 3.39772L19.9686 3.52772L12.8057 10.6907L5.64269 3.52772Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.367682"
      />
    </svg>
  )
}

export default CrossIcon
