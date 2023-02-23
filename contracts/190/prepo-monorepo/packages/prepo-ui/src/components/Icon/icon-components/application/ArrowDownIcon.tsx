import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name'>

const ArrowDownIcon: React.FC<Props> = ({ width = '31', height = '32', onClick }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 31 32"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    onClick={onClick}
  >
    <path
      d="M15.4572 18.7549L20.3086 13.9035C20.8343 13.3779 21.6875 13.3779 22.2131 13.9035C22.7387 14.4292 22.7387 15.2824 22.2131 15.808L16.3549 21.6662C15.8584 22.1627 15.0548 22.1627 14.5596 21.6662L8.70136 15.808C8.17572 15.2824 8.17572 14.4292 8.70136 13.9035C9.227 13.3779 10.0802 13.3779 10.6059 13.9035L15.4572 18.7549Z"
      fill="currentColor"
    />
  </svg>
)

export default ArrowDownIcon
