import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ChevronRightIcon: React.FC<Props> = ({ width = '16', height = '16', onClick }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    onClick={onClick}
  >
    <path
      d="M9.86257 9L5.59666 13.5799C5.13445 14.0762 5.13445 14.8816 5.59666 15.3778C6.05887 15.874 6.80911 15.874 7.27132 15.3778L12.4226 9.84742C12.8591 9.37875 12.8591 8.62005 12.4226 8.15258L7.27132 2.62217C6.80911 2.12594 6.05887 2.12594 5.59666 2.62217C5.13445 3.11839 5.13445 3.92386 5.59666 4.42009L9.86257 9Z"
      fill="currentColor"
    />
  </svg>
)

export default ChevronRightIcon
