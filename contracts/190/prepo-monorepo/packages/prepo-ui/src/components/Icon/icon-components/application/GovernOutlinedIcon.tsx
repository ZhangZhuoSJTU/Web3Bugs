import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'onClick'>

const GovernOutlinedIcon: React.FC<Props> = ({ color = 'white', width = '25', height = '25' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 21 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M11.5473 1.20769L10.0027 2.75228L6.54243 6.21257L5.02225 7.73275L6.20063 8.91114L7.13162 7.98015L8.72667 9.5752L2.2244 16.0775L3.40278 17.2559L9.90506 10.7536L11.6433 12.4919L10.6798 13.4554L11.8582 14.6338L13.4109 13.0794L16.8712 9.61915L18.5493 7.94271L17.3693 6.76433L16.282 7.85157L11.7719 3.33985L12.7257 2.38607L11.5473 1.20769ZM10.5919 4.51986L15.1036 9.02995L12.8217 11.3119L8.31001 6.80176L10.5919 4.51986ZM11.2902 15.8333V17.5H18.7902V15.8333H11.2902Z"
      fill={color}
    />
  </svg>
)

export default GovernOutlinedIcon
