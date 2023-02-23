import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ZoomInIconTwo: React.FC<Props> = ({
  color = 'white',
  width = '13',
  height = '14',
  onClick,
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 13 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <path
        d="M5.95833 10.7104C8.35157 10.7104 10.2917 8.77027 10.2917 6.37703C10.2917 3.9838 8.35157 2.0437 5.95833 2.0437C3.5651 2.0437 1.625 3.9838 1.625 6.37703C1.625 8.77027 3.5651 10.7104 5.95833 10.7104Z"
        stroke={color}
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.375 11.7937L9.0188 9.4375"
        stroke={color}
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.95837 4.75195V8.00195"
        stroke={color}
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.33337 6.37695H7.58337"
        stroke={color}
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default ZoomInIconTwo
