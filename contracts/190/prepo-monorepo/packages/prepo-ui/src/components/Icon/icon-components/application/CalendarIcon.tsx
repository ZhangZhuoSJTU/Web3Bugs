import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const CalendarIcon: React.FC<Props> = ({
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
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <path
        d="M4.66667 1.06934C4.26667 1.06934 4 1.336 4 1.736V2.40267H3.33333C2.6 2.40267 2 3.00267 2 3.736V4.40267V5.736V12.4027V13.0693C2 13.8693 2.53333 14.4027 3.33333 14.4027H4H12H12.6667C13.4667 14.4027 14 13.8693 14 13.0693V12.4027V5.736V4.40267V3.736C14 3.00267 13.4 2.40267 12.6667 2.40267H12V1.736C12 1.336 11.7333 1.06934 11.3333 1.06934C10.9333 1.06934 10.6667 1.336 10.6667 1.736V2.40267H5.33333V1.736C5.33333 1.336 5.06667 1.06934 4.66667 1.06934ZM3.33333 5.736H12.6667V12.4027C12.6667 12.8027 12.4 13.0693 12 13.0693H4C3.6 13.0693 3.33333 12.8027 3.33333 12.4027V5.736Z"
        fill={color}
      />
    </svg>
  )
}

export default CalendarIcon
