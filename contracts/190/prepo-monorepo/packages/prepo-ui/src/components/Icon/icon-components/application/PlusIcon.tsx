import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const PlusIcon: React.FC<Props> = ({ color = 'white', width = '15', height = '15', onClick }) => {
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
        d="M6.71641 2.16976H6.25971V2.62646V6.73677H2.14941H1.69271V7.19347V8.33522V8.79192H2.14941H6.25971V10.6187V12.9022V13.3589H6.71641H7.85816H8.31486V12.9022V10.6187V8.79192H12.4252H12.8819V8.33522V7.19347V6.73677H12.4252H8.31486V2.62646V2.16976H7.85816H6.71641Z"
        fill="current"
        stroke="current"
        strokeWidth="0.9134"
      />
    </svg>
  )
}

export default PlusIcon
