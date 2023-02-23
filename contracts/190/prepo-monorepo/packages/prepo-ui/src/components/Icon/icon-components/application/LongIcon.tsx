import { useTheme } from 'styled-components'
import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const LongIcon: React.FC<Props> = ({ width = 23, height = 14, disabled, onClick }) => {
  const theme = useTheme()
  const strokeColor = disabled ? theme.color.neutral5 : theme.color.success

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 23 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
    >
      <path
        d="M1.71619 13.1138L5.70456 7.37051C6.63025 6.03753 8.44815 5.68234 9.80749 6.56888L10.1635 6.80109C11.5071 7.67733 13.3022 7.34168 14.2384 6.03917L16.3932 3.04126C17.1981 1.92136 18.6629 1.49453 19.9434 2.00674L22.2838 2.94291"
        stroke={strokeColor}
        strokeWidth="2"
      />
    </svg>
  )
}

export default LongIcon
