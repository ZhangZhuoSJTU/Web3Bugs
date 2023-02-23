import { IconProps } from '../../icon.types'

type Props = Omit<IconProps, 'name' | 'color'>

const ColoredLiquiditity: React.FC<Props> = ({ width = '25', height = '25' }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 17 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9.8668 1.13314C9.0698 0.184137 7.6138 0.184137 6.8168 1.13314C4.4958 3.89714 0.341797 9.38514 0.341797 13.2551C0.341797 17.7121 3.8848 21.2551 8.3418 21.2551C12.7988 21.2551 16.3418 17.7121 16.3418 13.2551C16.3418 9.38514 12.1878 3.89714 9.8668 1.13314Z"
      fill="url(#paint0_radial_5305_4885)"
    />
    <defs>
      <radialGradient
        id="paint0_radial_5305_4885"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(8.3418 0.421387) rotate(90) scale(22.1998 25.2294)"
      >
        <stop offset="0.104167" stopColor="#5AE1FF" stopOpacity="0.57" />
        <stop offset="0.846734" stopColor="#46AEF7" />
      </radialGradient>
    </defs>
  </svg>
)

export default ColoredLiquiditity
