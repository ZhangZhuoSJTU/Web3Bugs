import { useTheme } from 'styled-components'
import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ShortIcon: React.FC<Props> = ({ width = 23, height = 14, disabled, onClick }) => {
  const theme = useTheme()
  const strokeColor = disabled ? theme.color.neutral5 : theme.color.error

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
        d="M21.8429 12.9978L17.8545 7.25455C16.9288 5.92156 15.1109 5.56638 13.7516 6.45291L13.3955 6.68513C12.052 7.56136 10.2569 7.22571 9.32068 5.92321L7.16593 2.92529C6.361 1.80539 4.89623 1.37856 3.61571 1.89077L1.2753 2.82694"
        stroke={strokeColor}
        strokeWidth="2"
      />
    </svg>
  )
}

export default ShortIcon
